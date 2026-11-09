// Lobby account character list (S2C opcode 0x0B39).
// Layout adapted from the MIT-licensed nuriland/a2kit project, copyright 2026 nuri.
// See THIRD-PARTY-NOTICES.md for the license and attribution.
using System.Buffers.Binary;
using System.Text;
using System.Text.Unicode;

namespace AtreiaCapture;

/// <summary>
/// Decodes the server's *own-account* character roster from the Aion 2 lobby.
/// Only verified names, server IDs, and levels leave the helper. Account IDs, session
/// tokens, session timestamps, flags and raw packet bytes are not exported.
/// </summary>
public static class LobbyRoster
{
    public sealed record Character(string Name, int ServerId, int Level);

    public static List<Character> Parse(ReadOnlySpan<byte> packet)
    {
        var empty = new List<Character>();
        if (packet.Length < 7 || packet.Length > 65536 || packet[0] != 0x0b || packet[1] != 0x39) return empty;
        // Make the bounded frame a local array so the checked readers cannot capture a ref struct.
        byte[] data=packet.ToArray();
        int p = 2;

        bool Need(int n) => n >= 0 && n <= data.Length - p;
        bool TakeU8(out byte value)
        {
            value = 0;
            if (!Need(1)) return false;
            value = data[p++];
            return true;
        }
        bool TakeU16(out ushort value)
        {
            value = 0;
            if (!Need(2)) return false;
            value = BinaryPrimitives.ReadUInt16LittleEndian(data.AsSpan(p,2));
            p += 2;
            return true;
        }
        bool TakeU32(out uint value)
        {
            value = 0;
            if (!Need(4)) return false;
            value = BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(p,4));
            p += 4;
            return true;
        }

        if (!TakeU16(out ushort header) || header != 0 || !TakeU8(out byte total) || total > 48)
            return empty;
        var roster=new List<Character>();
        for(int i=0;i<total;i++)
        {
            if(!TakeU16(out ushort server) ||
               !TakeU8(out byte nameLength) || nameLength > 80 || !Need(nameLength))
                return empty;
            ReadOnlySpan<byte> nameBytes=data.AsSpan(p,nameLength);
            if(!Utf8.IsValid(nameBytes)) return empty;
            string name=Encoding.UTF8.GetString(nameBytes);
            p+=nameLength;

            // Level u32 | experience u32 | reserved zero u32 | class code u32 | flags u8
            if(!TakeU32(out uint level) || !TakeU32(out _) ||
               !TakeU32(out uint reserved) || reserved != 0 ||
               !TakeU32(out uint classCode) || !TakeU8(out _))
                return empty;

            // Epoch milliseconds u64 + 8 reserved bytes are intentionally ignored.
            if(!Need(16)) return empty;
            p+=16;
            // Four-character groups have a 2-bits-per-entry presence mask.
            if(i%4==0)
            {
                if(!TakeU8(out byte mask))return empty;
                int remaining=Math.Min(4,total-i);
                if((mask >> (2*remaining)) != 0)return empty;
            }
            // A malformed record invalidates the entire roster.
            if(server is < 1000 or > 2999 || level>200 || classCode > 1000 ||
                name.Any(char.IsControl)) return empty;

            // Character-selection placeholders are not playable characters.
            if(!string.IsNullOrWhiteSpace(name) &&
               !name.StartsWith('$') && name.Length<=40 &&
               !roster.Any(x=>x.ServerId==server &&
                      string.Equals(x.Name,name,StringComparison.OrdinalIgnoreCase)))
                roster.Add(new Character(name,server,(int)level));
        }

        if(!TakeU16(out ushort tail) || tail!=0x0101 || p!=data.Length)
            return empty;
        return roster;
    }
}
