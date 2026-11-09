// Account roster parser adapted from MIT-licensed SkeeveTV/Aion-DPS-Meter,
// Copyright (c) 2026 SkeeveTV. See THIRD-PARTY-NOTICES.md.
using System.Buffers.Binary;
using System.Text;
using System.Text.Unicode;

namespace AtreiaCapture;

/// <summary>
/// Parses only the player's OWN account character-selection list frames (0x2636, large 0x1536).
/// No account key, login token, unrelated player, or raw frame leaves this process.
/// </summary>
public static class AccountRoster
{
    public sealed record Character(string Name, int ServerId, int Level);
    private static bool TryName(ReadOnlySpan<byte> frame,int at,out string name)
    {
        name="";
        int len=frame[at];
        if(len is < 2 or > 24||at+1+len>frame.Length)return false;
        ReadOnlySpan<byte> raw=frame.Slice(at+1,len);
        if(!Utf8.IsValid(raw))return false;
        string candidate=Encoding.UTF8.GetString(raw);
        if(!candidate.All(char.IsLetterOrDigit))return false;
        name=candidate;
        return true;
    }
    public static List<Character> Parse(ReadOnlySpan<byte> frame)
    {
        List<(int Start,int After,string Name)> starts=new();
        if(frame.Length<64)return new();
        for(int i=2;i+60<frame.Length;i++)
        {
            if(!TryName(frame,i,out string name))continue;
            int after=i+1+frame[i];
            if(after+60>frame.Length)continue;
            uint code=BinaryPrimitives.ReadUInt32LittleEndian(frame[after..]);
            if(code<1||(code-1)/4 is <1 or >9||
                frame[after+4] is not (1 or 2)||frame[after+6] is <1 or >200)continue;
            starts.Add((i,after,name));
            i=after;
        }
        var result=new List<Character>();
        var unique=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for(int s=0;s<starts.Count;s++)
        {
            var entry=starts[s];
            int end=s+1<starts.Count?starts[s+1].Start:frame.Length;
            int legionAt=entry.After+38;
            if(legionAt>=end)continue;
            int legionLength=frame[legionAt];
            if(legionLength>40||legionAt+1+legionLength>end)continue;
            if(legionLength>0&&!Utf8.IsValid(frame.Slice(legionAt+1,legionLength)))continue;
            int block=legionAt+1+legionLength;
            int serverId=0;
            // Tail from verified character-select layouts:
            // character ID u32 | 00 00 | server ID u16 | 00000000 | timestamp u64
            for(int k=block+32;k+20<=end;k++)
            {
                uint charId=BinaryPrimitives.ReadUInt32LittleEndian(frame[k..]);
                ushort candidate=BinaryPrimitives.ReadUInt16LittleEndian(frame[(k+6)..]);
                ulong stamp=BinaryPrimitives.ReadUInt64LittleEndian(frame[(k+12)..]);
                if(charId is >0 and <100000000 && frame[k+4]==0 && frame[k+5]==0 &&
                    candidate is >=1001 and <=2999 &&
                    BinaryPrimitives.ReadUInt32LittleEndian(frame[(k+8)..])==0 &&
                    stamp is >=1700000000000 and <=2200000000000)
                {
                    serverId=candidate;
                    break;
                }
            }
            if(serverId==0)continue;
            if(!unique.Add(entry.Name+"/"+serverId))continue;
            result.Add(new Character(entry.Name,serverId,frame[entry.After+6]));
            if(result.Count>=40)break;
        }
        return result;
    }
}
