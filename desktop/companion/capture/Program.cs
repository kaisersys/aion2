using System.Collections.Concurrent;
using System.Text.Json;
using PacketDotNet;
using SharpPcap;
using SharpPcap.LibPcap;

namespace AtreiaCapture;

public static class Program
{
    private static readonly object OutputLock = new();
    private static readonly CancellationTokenSource Stop = new();

    public static void Emit(object value)
    {
        lock (OutputLock) Console.WriteLine(JsonSerializer.Serialize(value));
    }
    public static void Status(string state, string message) =>
        Emit(new { kind = "status", state, message });

    public static int Main(string[] args)
    {
        if (args.Contains("--self-test")) return SelfTest.Run();
        var ports = new HashSet<int> { 13328 };
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i] != "--ports") continue;
            ports = new HashSet<int>();
            foreach (string item in args[i + 1].Split(','))
                if (int.TryParse(item, out int port) && port is > 0 and <= 65535) ports.Add(port);
        }
        if (ports.Count == 0) { Status("error", "Supply at least one valid Aion 2 server port."); return 2; }
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; Stop.Cancel(); };
        AppDomain.CurrentDomain.ProcessExit += (_, _) => Stop.Cancel();
        using var service = new ReadOnlyCapture(ports);
        return service.Run(Stop.Token);
    }
}

internal sealed class ReadOnlyCapture : IDisposable
{
    private readonly HashSet<int> _ports;
    private readonly BlockingCollection<TcpSegment> _queue = new(50000);
    private readonly TcpReassembler _reassembler = new();
    private readonly FrameLayout _layout = new();
    private readonly TicketProtocol _protocol = new(Program.Emit);
    private readonly List<ILiveDevice> _devices = new();
    private readonly HashSet<int> _knownOpcodes = new();
    private long _segments;
    private long _frames;
    private long _dropped;
    private HashSet<string> _autoEndpoints = new(StringComparer.Ordinal);
    private bool _gameRunning;
    private int _gameConnections;
    private bool _gameViaLoopback;
    private string? _osLookupError;
    private string _appliedFilter = "";
    private long _nextConnectionCheck;
    public ReadOnlyCapture(HashSet<int> ports)
    {
        _ports = ports;
        try {
            using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "known-opcodes.json")));
            foreach (JsonElement op in doc.RootElement.GetProperty("syncOpcodes").EnumerateArray())
                _knownOpcodes.Add(op.GetInt32());
        } catch { /* without known opcodes, framing will attempt generic sync */ }
    }

    public int Run(CancellationToken cancellation)
    {
        try
        {
            var available = CaptureDeviceList.Instance;
            if (available.Count == 0) { Program.Status("error", "Npcap driver not found. Install Npcap separately and enable its service."); return 3; }
            RefreshGameConnections();
            int opened = 0;
            foreach (ILiveDevice device in available.Cast<ILiveDevice>())
            {
                try
                {
                    device.Open(new DeviceConfiguration {
                        ReadTimeout = 250, Mode = DeviceModes.None, KernelBufferSize = 16 * 1024 * 1024
                    });
                    // Default game port plus only AION2.exe-owned TCP remote endpoints.
                    // This avoids indiscriminate capture of unrelated applications.
                    device.Filter = CaptureFilter();
                    device.OnPacketArrival += OnPacket;
                    device.StartCapture();
                    _devices.Add(device);
                    opened++;
                }
                catch (Exception ex) when (ex is PcapException or InvalidOperationException)
                {
                    try { device.Close(); } catch { }
                }
            }
            if (opened == 0) { Program.Status("error", "Npcap cannot open any network adapters."); return 4; }
            Program.Status("listening", $"Npcap active on {opened} network adapter(s). Automatic AION2.exe connection tracking enabled; teleport across zones if your character is already logged in.");
            long nextHealth = Environment.TickCount64;
            while (!cancellation.IsCancellationRequested)
            {
                if (Environment.TickCount64 >= _nextConnectionCheck)
                    RefreshGameConnections();
                if (_queue.TryTake(out TcpSegment? segment, 500))
                {
                    try {
                        foreach (ReadOnlyMemory<byte> frame in _reassembler.Push(segment, _layout, _knownOpcodes))
                        {
                            _frames++;
                            _protocol.OnFrame(frame, segment.Timestamp.ToUniversalTime());
                        }
                    }
                    catch { /* never preserve raw frames or abort capture on a malformed message */ }
                }
                if (Environment.TickCount64 >= nextHealth)
                {
                    nextHealth = Environment.TickCount64 + 2000;
                    // Aggregate diagnostics only: no network addresses, packet bytes,
                    // raw frames, or account identifiers are emitted or persisted.
                    Program.Emit(new {
                        kind = "health", packets = Interlocked.Read(ref _segments),
                        frames = _frames, identities = _protocol.CharacterRecords,
                        rosters = _protocol.RosterRecords,
                        dropped = Interlocked.Read(ref _dropped),
                        gaps = _reassembler.Gaps, desyncs = _reassembler.Desyncs,
                        port = string.Join(",", _ports.OrderBy(x=>x)),
                        gameRunning = _gameRunning, connections = _gameConnections,
                        loopback = _gameViaLoopback, adapters = opened,
                        osLookupError = _osLookupError
                    });
                }
            }
            return 0;
        }
        catch (Exception ex) when (ex is DllNotFoundException or TypeInitializationException or PcapException)
        {
            Program.Status("error", "Npcap could not initialize: " + ex.GetBaseException().Message);
            return 5;
        }
    }

    private string CaptureFilter()
    {
        var expressions=new List<string>();
        expressions.AddRange(_ports.OrderBy(x=>x).Select(p=>$"src port {p}"));
        // Only Windows-owned AION2.exe connection destinations, no broad 443 capture.
        foreach(var endpoint in _lastDiscovered.Values.OrderBy(x=>x.Key,StringComparer.Ordinal))
            expressions.Add(endpoint.Filter);
        return "tcp and ("+string.Join(" or ",expressions)+")";
    }

    private Dictionary<string,GameConnections.Endpoint> _lastDiscovered=new(StringComparer.Ordinal);

    private void RefreshGameConnections()
    {
        _nextConnectionCheck=Environment.TickCount64+4000;
        var observed=GameConnections.Observe();
        _gameRunning=observed.Running;
        _gameConnections=observed.Endpoints.Count;
        _gameViaLoopback=observed.Endpoints.Any(e=>e.Loopback);
        _osLookupError=observed.Error;
        var fresh=observed.Endpoints.ToDictionary(x=>x.Key,StringComparer.Ordinal);
        _lastDiscovered=fresh;
        Volatile.Write(ref _autoEndpoints,fresh.Keys.ToHashSet(StringComparer.Ordinal));
        string filter=CaptureFilter();
        if(filter==_appliedFilter) return;
        _appliedFilter=filter;
        foreach(var device in _devices)
        {
            try { device.Filter=filter; }
            catch(PcapException) { /* Retain existing filter, visible counters still update. */ }
        }
    }

    private void OnPacket(object sender, PacketCapture capture)
    {
        try
        {
            var raw = capture.GetPacket();
            Packet packet = Packet.ParsePacket(raw.LinkLayerType, raw.Data);
            TcpPacket? tcp = packet.Extract<TcpPacket>();
            IPPacket? ip = packet.Extract<IPPacket>();
            if (tcp is null || ip is null) return;
            string endpoint=ip.SourceAddress+":"+tcp.SourcePort;
            if (!_ports.Contains(tcp.SourcePort) && !Volatile.Read(ref _autoEndpoints).Contains(endpoint)) return;
            byte[] payload = tcp.PayloadData ?? Array.Empty<byte>();
            if (payload.Length == 0) return;
            Interlocked.Increment(ref _segments);
            var segment = new TcpSegment(raw.Timeval.Date.ToLocalTime(), $"{ip.SourceAddress}:{tcp.SourcePort}",
                $"{ip.DestinationAddress}:{tcp.DestinationPort}", tcp.SequenceNumber, payload, true);
            if (!_queue.TryAdd(segment)) Interlocked.Increment(ref _dropped);
        }
        catch { /* ignore malformed, unrelated or truncated segments */ }
    }

    public void Dispose()
    {
        foreach (ILiveDevice device in _devices)
        {
            try { device.StopCapture(); device.Close(); device.Dispose(); } catch { }
        }
        _queue.CompleteAdding();
        _queue.Dispose();
    }
}

public static class SelfTest
{
    public static int Run()
    {
        try
        {
            // Ticket 4 Nightmare, 6 remaining; then update 5 remaining.
            byte[] list = {0x0b,0x61,0x01,0x04,0x04,0,0,0,0x06};
            if (!TicketProtocol.TryReadList(list, out List<TicketReading> entries) ||
                entries.Count != 1 || entries[0].Id != 4 || entries[0].Count != 6)
                throw new Exception("Login ticket decode failed.");
            byte[] change = {0x0c,0x61,0,0x04,0x04,0,0,0,0x05,0x03};
            if (!TicketProtocol.TryReadUpdate(change, out TicketReading update) || update.Count != 5)
                throw new Exception("Ticket delta decode failed.");
            byte[] wallet = new byte[50];
            wallet[0] = 0x1b; wallet[1] = 0x56;
            int i=10;
            System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(wallet.AsSpan(2+i), 930100001u);
            System.Buffers.Binary.BinaryPrimitives.WriteUInt64LittleEndian(wallet.AsSpan(2+i+4), 123456789UL);
            wallet[2+i+12] = 1;
            if (!TicketProtocol.TryReadBoundKinah(wallet,out long amount) || amount!=123456789L)
                throw new Exception("Bound Kinah inventory quantity decode failed.");
            byte[] roster=new byte[160];
            roster[0]=0x26; roster[1]=0x36;
            int nameAt=8;
            roster[nameAt]=4;
            System.Text.Encoding.UTF8.GetBytes("Ceti",roster.AsSpan(nameAt+1));
            int after=nameAt+5;
            System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(roster.AsSpan(after),9);
            roster[after+4]=1; // faction
            roster[after+6]=45; // level
            System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(roster.AsSpan(after+14),1450);
            int tail=after+38+1+32;
            System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(roster.AsSpan(tail),123456u);
            System.Buffers.Binary.BinaryPrimitives.WriteUInt16LittleEndian(roster.AsSpan(tail+6),1204);
            System.Buffers.Binary.BinaryPrimitives.WriteUInt64LittleEndian(roster.AsSpan(tail+12),1800000000000UL);
            List<AccountRoster.Character> account=AccountRoster.Parse(roster);
            if(account.Count!=1||account[0].Name!="Ceti"||account[0].ServerId!=1204)
                throw new Exception("Account roster decode failed.");
            // Regression: the own-character frame may be 40 kB long on a teleport
            // to a new zone. It must survive many TCP fragments beyond the old
            // unsynced 8 KB ring-buffer cutoff.
            byte[] identityBody = new byte[40000];
            identityBody[0]=0x33;
            identityBody[1]=0x36;
            long declared=identityBody.Length + 4; // varint body length includes bias +4
            var prefix=new List<byte>();
            do {
                byte next=(byte)(declared & 0x7f);
                declared >>= 7;
                if(declared>0)next|=0x80;
                prefix.Add(next);
            } while(declared>0);
            byte[] wire=prefix.Concat(identityBody).ToArray();
            var assembler=new TcpReassembler();
            var frameLayout=new FrameLayout();
            var known=new HashSet<int>{0x3336};
            int emitted=0;
            // A partial next frame immediately following identity is a realistic
            // network situation and must not block accepting the complete identity.
            byte[] joined=wire.Concat(new byte[]{0x10,0x33}).ToArray();
            for(int offset=0;offset<joined.Length;offset+=1200)
            {
                int size=Math.Min(1200,joined.Length-offset);
                var seg=new TcpSegment(DateTime.UtcNow,"server:13328","local:52344",
                    (uint)(1000+offset),joined.AsMemory(offset,size),true);
                var output=assembler.Push(seg,frameLayout,known);
                emitted+=output.Count;
                if(output.Any(f=>f.Length!=identityBody.Length))
                    throw new Exception("Partial character frame emitted as complete.");
            }
            if(emitted!=1)
                throw new Exception($"Large teleport identity frame lost (received {emitted}).");
            if (GameConnections.RemotePort(0x00001034u)!=13328)
                throw new Exception("TCP owner table remote-port endianness failed.");
            Console.WriteLine("Packet parsing self-test passed.");
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
    }
}
