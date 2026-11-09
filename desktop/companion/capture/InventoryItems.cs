using System.Buffers.Binary;

namespace AtreiaCapture;

/// <summary>
/// Passive inventory observation for Aion 2's known inventory messages.
/// 0x1156 gives an inventory baseline, 0x1B56 changes an individual stack:
/// [opcode BE] [container=1] [kind=0/1/2] [reserved=0]
/// [handle u32 LE] [reserved u32=0] [itemId u32 LE] [count u64 LE].
/// Only validated item ID / quantity changes leave the capture helper.
/// No market order IDs, packet contents or game-memory access are involved.
/// </summary>
public sealed class InventoryItems
{
    public readonly record struct Delta(uint ItemId, long Quantity, string Direction);
    private readonly Dictionary<uint,(uint ItemId,long Count)> _handles = new();
    public bool HasBaseline { get; private set; }
    public int TrackedStacks => _handles.Count;
    public int ItemUpdates { get; private set; }
    public int EmittedDeltas { get; private set; }

    private static bool RealItem(uint item) => item is >= 100_000_000 and < 1_000_000_000 &&
       item is not (930100001u or 930100031u or 930100030u);

    public void Reset()
    {
        _handles.Clear();
        HasBaseline=false;
    }

    /// <summary>
    /// The full inventory is deliberately a baseline, never an item purchase
    /// or gain. A match requires a nonzero slot handle and the documented
    /// four reserved zero bytes before an item ID. Limit scanning to 256 KiB.
    /// </summary>
    public bool Baseline(ReadOnlySpan<byte> frame)
    {
        if(frame.Length<5000 || frame.Length>262144 ||
            frame[0]!=0x11 || frame[1]!=0x56) return false;

        var snapshot=new Dictionary<uint,(uint ItemId,long Count)>();
        ReadOnlySpan<byte> reservedZero=stackalloc byte[4];
        for(int i=10;i+12<=frame.Length;i++)
        {
            uint item=BinaryPrimitives.ReadUInt32LittleEndian(frame[i..]);
            if(!RealItem(item) || !frame.Slice(i-4,4).SequenceEqual(reservedZero))
                continue;
            uint handle=BinaryPrimitives.ReadUInt32LittleEndian(frame[(i-8)..]);
            ulong count=BinaryPrimitives.ReadUInt64LittleEndian(frame[(i+4)..]);
            if(handle==0 || count is < 1 or > 100_000_000_000UL)continue;
            snapshot[handle]=(item,(long)count);
            i+=11;
        }
        // Avoid treating a malformed or unrelated frame as a complete baseline.
        if(snapshot.Count<2)return false;
        _handles.Clear();
        foreach(var kv in snapshot)_handles[kv.Key]=kv.Value;
        HasBaseline=true;
        return true;
    }

    public Delta? Update(ReadOnlySpan<byte> frame)
    {
        if(frame.Length<25 || frame[0]!=0x1b || frame[1]!=0x56 ||
           frame[2]!=1 || frame[4]!=0 ||
           !frame.Slice(9,4).SequenceEqual(stackalloc byte[4]))return null;

        byte kind=frame[3];
        if(kind>2)return null;
        uint handle=BinaryPrimitives.ReadUInt32LittleEndian(frame[5..]);
        uint item=BinaryPrimitives.ReadUInt32LittleEndian(frame[13..]);
        ulong count=BinaryPrimitives.ReadUInt64LittleEndian(frame[17..]);
        if(handle==0 || !RealItem(item) || count>100_000_000_000UL)return null;
        ItemUpdates++;
        bool known=_handles.TryGetValue(handle,out var old);
        // A removal only reports an outflow if the handle was known and matched.
        // Losing an item may mean consumption, crafting or sale; no cause is assumed.
        if(kind==2)
        {
            _handles.Remove(handle);
            if(!HasBaseline || !known || old.ItemId!=item || old.Count<=0)return null;
            EmittedDeltas++;
            return new Delta(item,-old.Count,"removed");
        }
        _handles[handle]=(item,(long)count);
        if(!HasBaseline)return null;
        if(!known)
        {
            if(kind!=0 || count==0)return null;
            EmittedDeltas++;
            return new Delta(item,(long)count,"added");
        }
        if(old.ItemId!=item || old.Count==(long)count)return null;
        long delta=checked((long)count-old.Count);
        if(delta==0)return null;
        EmittedDeltas++;
        return new Delta(item,delta,delta>0?"added":"removed");
    }
}
