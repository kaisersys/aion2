using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;

namespace AtreiaCapture;

/// <summary>
/// Reads OS-maintained TCP connection metadata for the AION2 process.
/// No game-memory access, packet payload inspection, process injection, or
/// client changes. Every endpoint is kept in process and never sent to Electron.
/// </summary>
internal static class GameConnections
{
    private const int AddressFamilyIpv4 = 2;
    private const int OwnerPidAll = 5;
    private const uint Established = 5;

    [StructLayout(LayoutKind.Sequential)]
    private struct TcpOwnerRow
    {
        public uint State, LocalAddress, LocalPort, RemoteAddress, RemotePort, OwnerPid;
    }

    [DllImport("iphlpapi.dll", SetLastError = true)]
    private static extern uint GetExtendedTcpTable(
        IntPtr table, ref int size, bool order, int addressFamily,
        int tableClass, uint reserved);

    internal sealed record Snapshot(bool Running, IReadOnlyList<Endpoint> Endpoints, string? Error);
    internal sealed record Endpoint(string Address, int Port, bool Loopback)
    {
        public string Filter => $"(src host {Address} and src port {Port})";
        public string Key => Address + ":" + Port;
    }

    internal static int RemotePort(uint networkOrder) =>
        (int)(((networkOrder & 0xff) << 8) | ((networkOrder >> 8) & 0xff));

    internal static Snapshot Observe()
    {
        var pids=new HashSet<int>();
        try
        {
            foreach (var proc in Process.GetProcesses())
            {
                try
                {
                    // AION2.exe is the game, not the launcher or an arbitrary game helper.
                    if (proc.ProcessName.Equals("AION2", StringComparison.OrdinalIgnoreCase))
                        pids.Add(proc.Id);
                }
                catch (Exception e) when (e is InvalidOperationException or System.ComponentModel.Win32Exception or System.Security.SecurityException) { }
                finally { proc.Dispose(); }
            }
        }
        catch (Exception e)
        {
            return new Snapshot(false,Array.Empty<Endpoint>(),"Windows process lookup: "+e.GetType().Name);
        }
        if (pids.Count==0) return new Snapshot(false,Array.Empty<Endpoint>(),null);
        IntPtr ptr=IntPtr.Zero;
        try
        {
            int bytes=0;
            GetExtendedTcpTable(IntPtr.Zero, ref bytes, true, AddressFamilyIpv4, OwnerPidAll,0);
            if (bytes<=4 || bytes>8*1024*1024)
                return new Snapshot(true,Array.Empty<Endpoint>(),"Windows returned invalid TCP table size");
            ptr=Marshal.AllocHGlobal(bytes);
            uint error=GetExtendedTcpTable(ptr,ref bytes,true,AddressFamilyIpv4,OwnerPidAll,0);
            if(error!=0)
                return new Snapshot(true,Array.Empty<Endpoint>(),"TCP owner lookup error "+error);
            int rowSize=Marshal.SizeOf<TcpOwnerRow>();
            int count=Marshal.ReadInt32(ptr);
            int maxRows=(bytes-4)/rowSize;
            if(count<0 || count>maxRows)
                return new Snapshot(true,Array.Empty<Endpoint>(),"Malformed Windows TCP table");
            var result=new Dictionary<string,Endpoint>(StringComparer.Ordinal);
            for(int i=0;i<count;i++)
            {
                var row=Marshal.PtrToStructure<TcpOwnerRow>(IntPtr.Add(ptr,4+i*rowSize));
                if(row.State!=Established || !pids.Contains(unchecked((int)row.OwnerPid)))continue;
                int port=RemotePort(row.RemotePort);
                if(port<1 || port>65535)continue;
                var ip=new IPAddress(BitConverter.GetBytes(row.RemoteAddress));
                if(IPAddress.Any.Equals(ip) || IPAddress.Broadcast.Equals(ip))continue;
                bool loopback=IPAddress.IsLoopback(ip);
                var endpoint=new Endpoint(ip.ToString(),port,loopback);
                result[endpoint.Key]=endpoint;
            }
            return new Snapshot(true,result.Values.ToList(),null);
        }
        catch (Exception e) when (e is DllNotFoundException or EntryPointNotFoundException or
                                   ArgumentException or OverflowException or AccessViolationException)
        {
            return new Snapshot(true,Array.Empty<Endpoint>(),"TCP owner lookup: "+e.GetType().Name);
        }
        finally { if(ptr!=IntPtr.Zero)Marshal.FreeHGlobal(ptr); }
    }
}
