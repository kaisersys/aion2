using System.Buffers.Binary;

namespace AtreiaCapture;

/// <summary>
/// Passive, evidence-backed source detection for ground pickups only.
/// A ground-spawn record (0x1E56) plus an own-pickup removal (0x1F56)
/// must match one positive inventory delta (0x1B56) in either arrival order.
/// No Market or merchant source is inferred from wallet or inventory deltas.
/// Ground IDs and packet bytes never leave this process.
/// </summary>
public sealed class TransactionSources
{
    private readonly record struct Drop(uint ItemId, long Count);
    private readonly record struct Pickup(uint ItemId, long Count, DateTime At);
    private readonly record struct Inventory(uint ItemId, long Count, string EventId, DateTime At);
    private readonly Dictionary<uint, Drop> _ground = new();
    private readonly Queue<uint> _groundOrder = new();
    private readonly List<Pickup> _pendingPickups = new();
    private readonly List<Inventory> _pendingInventory = new();
    private readonly Action<string, uint, long, DateTime> _confirmed;
    private static readonly TimeSpan MatchWindow = TimeSpan.FromMilliseconds(1500);

    public int GroundItemsSeen { get; private set; }
    public int OwnPickupsSeen { get; private set; }
    public int MatchedPickups { get; private set; }

    public TransactionSources(Action<string, uint, long, DateTime> confirmed) =>
        _confirmed = confirmed;

    public void Reset()
    {
        _ground.Clear();
        _groundOrder.Clear();
        _pendingPickups.Clear();
        _pendingInventory.Clear();
    }

    private static bool RealItem(uint id) =>
        id >= 100_000_000 && id < 1_000_000_000 &&
        id is not (930100001u or 930100031u or 930100030u);

    private void Prune(DateTime now)
    {
        _pendingPickups.RemoveAll(x => Math.Abs((now - x.At).TotalMilliseconds) > MatchWindow.TotalMilliseconds);
        _pendingInventory.RemoveAll(x => Math.Abs((now - x.At).TotalMilliseconds) > MatchWindow.TotalMilliseconds);
    }

    /// <summary>Observed ground-item spawn. Preserve the opaque loot ID only in memory.</summary>
    public void GroundAppeared(ReadOnlySpan<byte> frame)
    {
        if (frame.Length < 47 || frame[0] != 0x1e || frame[1] != 0x56 ||
            frame[2] != 1) return;
        uint lootId = BinaryPrimitives.ReadUInt32LittleEndian(frame[35..]);
        uint itemId = BinaryPrimitives.ReadUInt32LittleEndian(frame[39..]);
        long count = BinaryPrimitives.ReadUInt32LittleEndian(frame[43..]);
        if (lootId == 0 || !RealItem(itemId) || count is < 1 or > 1_000_000_000)
            return;
        GroundItemsSeen++;
        if (_ground.TryAdd(lootId, new Drop(itemId, count)))
            _groundOrder.Enqueue(lootId);
        while (_groundOrder.Count > 500)
            _ground.Remove(_groundOrder.Dequeue());
    }

    /// <summary>
    /// One or more ground drops disappear. Only last-byte=1 is an own pickup,
    /// and only a previously seen loot ID can provide source evidence.
    /// </summary>
    public void GroundDisappeared(ReadOnlySpan<byte> frame, DateTime at)
    {
        if (frame.Length < 24 || frame[0] != 0x1f || frame[1] != 0x56)
            return;
        int count = frame[2];
        if (count < 1 || count > 64 || frame.Length != 4 + count * 20) return;
        bool ours = frame[^1] == 1;
        if (!ours && frame[^1] != 0) return;
        Prune(at);
        for (int i = 0; i < count; i++)
        {
            uint lootId = BinaryPrimitives.ReadUInt32LittleEndian(frame[(11 + 20 * i)..]);
            if (!_ground.Remove(lootId, out Drop drop) || !ours) continue;
            OwnPickupsSeen++;
            var matches = _pendingInventory.Where(x =>
                x.ItemId == drop.ItemId && x.Count == drop.Count &&
                Math.Abs((at - x.At).TotalMilliseconds) <= MatchWindow.TotalMilliseconds).ToArray();
            if (matches.Length > 1)
            {
                // Two same-item inventory updates are ambiguous: do not choose one.
                _pendingInventory.RemoveAll(x => matches.Contains(x));
            }
            else if (matches.Length == 1)
            {
                _pendingInventory.Remove(matches[0]);
                MatchedPickups++;
                _confirmed(matches[0].EventId, drop.ItemId, drop.Count, at);
            }
            else
            {
                _pendingPickups.Add(new Pickup(drop.ItemId, drop.Count, at));
                if (_pendingPickups.Count > 128) _pendingPickups.RemoveAt(0);
            }
        }
    }

    /// <summary>Only a validated positive inventory delta can close the evidence chain.</summary>
    public void InventoryAdded(uint itemId, long delta, string eventId, DateTime at)
    {
        if (!RealItem(itemId) || delta <= 0 || delta > 1_000_000_000 ||
            string.IsNullOrEmpty(eventId)) return;
        Prune(at);
        var matches = _pendingPickups.Where(x =>
            x.ItemId == itemId && x.Count == delta &&
            Math.Abs((at - x.At).TotalMilliseconds) <= MatchWindow.TotalMilliseconds).ToArray();
        if (matches.Length > 1)
        {
            _pendingPickups.RemoveAll(x => matches.Contains(x));
        }
        else if (matches.Length == 1)
        {
            _pendingPickups.Remove(matches[0]);
            MatchedPickups++;
            _confirmed(eventId, itemId, delta, at);
        }
        else
        {
            _pendingInventory.Add(new Inventory(itemId, delta, eventId, at));
            if (_pendingInventory.Count > 128) _pendingInventory.RemoveAt(0);
        }
    }
}
