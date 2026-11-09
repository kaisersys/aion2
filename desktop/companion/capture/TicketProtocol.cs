using System.Buffers.Binary;
using System.Text;
using System.Text.Unicode;

namespace AtreiaCapture;

public readonly record struct TicketReading(uint Id, long Count, long Bonus, long TimeMs);
public sealed record CounterDef(string Key, string Frequency, string Scope, int Max);

/// <summary>
/// Server-side Aion 2 character, inventory and contents-ticket messages. Outputs only explicitly
/// observed values; it never converts wallet deltas into fabricated earned/spent transactions.
/// Record layouts verified against community captures, with attribution in THIRD-PARTY-NOTICES.md.
/// </summary>
public sealed class TicketProtocol
{
    private readonly Action<object> _emit;
    private readonly Dictionary<uint, TicketReading> _pendingTickets = new();
    private readonly Dictionary<uint, TicketReading> _latestTickets = new();
    private bool _awaitingCharacter;
    private long? _pendingBoundKinah;
    private string? _currentName;
    private int _currentServerId;

    public int CharacterRecords { get; private set; }
    public int RosterRecords { get; private set; }

    public TicketProtocol(Action<object> emit) => _emit = emit;

    // The only emitted counters are those that can safely be mapped to the site's existing
    // task keys or to explicitly named informational resource counters.
    private static readonly Dictionary<uint, CounterDef> Counters = new()
    {
        [1] = new("shugo-server", "daily", "server", 12),
        [4] = new("nightmare", "daily", "character", 14),
        [7] = new("shugo-character", "daily", "character", 28),
        [8] = new("invasion", "daily", "server", 7),
        [101] = new("unknown-fissure", "weekly", "server", 14),
        [60000001] = new("odyle-energy", "daily", "character", 560),
        [70000001] = new("subjugation", "weekly", "character", 3),
        [80000001] = new("ascension", "weekly", "character", 3),
        [90000002] = new("raid-ludra", "weekly", "character", 1),
        [60000101] = new("conq-krao", "daily", "character", 14),
        [60001201] = new("conq-urugugu", "daily", "character", 14),
        [60002201] = new("conq-fire", "daily", "character", 14),
        [60003201] = new("conq-draupnir", "daily", "character", 14),
        [60007201] = new("conq-vakron", "daily", "character", 14),
        [60009201] = new("conq-ferocious", "daily", "character", 14),
        [60005301] = new("trans-deus", "daily", "character", 4),
        [60006301] = new("trans-arkanis", "daily", "character", 4),
        [60000201] = new("explore-krao", "weekly", "character", 7),
        [60001101] = new("explore-urugugu", "weekly", "character", 7),
        [60002101] = new("explore-fire", "weekly", "character", 7),
        [60003101] = new("explore-draupnir", "weekly", "character", 7),
        [60007101] = new("explore-vakron", "weekly", "character", 7),
        [60009101] = new("explore-ferocious", "weekly", "character", 7)
    };

    public void OnFrame(ReadOnlyMemory<byte> frameMemory, DateTime observedAt)
    {
        ReadOnlySpan<byte> frame = frameMemory.Span;
        if (frame.Length < 3) return;
        int opcode = frame[0] << 8 | frame[1];
        switch (opcode)
        {
            case 0x0b61:
                if (TryReadList(frame, out List<TicketReading> entries))
                {
                    _awaitingCharacter = true;
                    _pendingTickets.Clear();
                    foreach (TicketReading entry in entries) _pendingTickets[entry.Id] = entry;
                }
                break;
            case 0x0c61:
                if (TryReadUpdate(frame, out TicketReading update))
                {
                    if (_awaitingCharacter) _pendingTickets[update.Id] = update;
                    else if (_currentName is not null) PublishTicket(update, observedAt);
                }
                break;
            case 0x2636: // own-account character roster after switching to character selection
            case 0x1536 when frame.Length > 500: // some initial-login roster frames
                var roster = AccountRoster.Parse(frame);
                if (roster.Count > 0)
                {
                    RosterRecords++;
                    _emit(new { kind = "roster", characters = roster });
                }
                break;
            case 0x3336:
                if (TryReadCharacter(frame, out string name, out int serverId))
                {
                    CharacterRecords++;
                    bool changed = _currentName != name || _currentServerId != serverId;
                    _currentName = name;
                    _currentServerId = serverId;
                    _emit(new { kind = "character", name, serverId });
                    if (_awaitingCharacter)
                    {
                        _latestTickets.Clear();
                        foreach (TicketReading entry in _pendingTickets.Values) PublishTicket(entry, observedAt);
                        _pendingTickets.Clear();
                        _awaitingCharacter = false;
                    }
                    if (_pendingBoundKinah is long amount)
                    {
                        PublishWallet(amount, observedAt);
                        _pendingBoundKinah = null;
                    }
                }
                break;
            case 0x1156: // login inventory snapshot
            case 0x1b56: // inventory slot changes; not inherently a transaction
                if (opcode != 0x1156 || frame.Length > 5000)
                {
                    if (TryReadBoundKinah(frame, out long balance))
                    {
                        if (_awaitingCharacter || _currentName is null) _pendingBoundKinah = balance;
                        else PublishWallet(balance, observedAt);
                    }
                }
                break;
        }
    }

    private void PublishWallet(long amount, DateTime at)
    {
        if (_currentName is null) return;
        // 930100001 is identified as BOUND Kinah. Do not present this as total
        // Kinah or use it to derive gross earnings and expenses.
        _emit(new
        {
            kind = "event", @event = new
            {
                id = Guid.NewGuid().ToString("N"), type = "wallet_snapshot",
                character = _currentName, serverId = _currentServerId,
                balance = amount, currency_kind = "bound",
                occurred_at = at.ToUniversalTime().ToString("O"), source = "decoded"
            }
        });
    }

    private void PublishTicket(TicketReading reading, DateTime at)
    {
        if (_currentName is null || !Counters.TryGetValue(reading.Id, out CounterDef? def)) return;
        if (_latestTickets.TryGetValue(reading.Id, out TicketReading previous) && previous.Equals(reading)) return;
        _latestTickets[reading.Id] = reading;
        int maximum = def.Max;
        if (reading.Id == 60000001)
        {
            // Odyle Energy: count and bonus are *different* fields, premium subscriptions can
            // increase the cap. Record only the normal count, never fold bonus into it.
            maximum = Math.Max(maximum, (int)Math.Min(1000000, reading.Count));
        }
        else if (reading.Count > maximum) maximum = (int)Math.Min(1000000, reading.Count);
        _emit(new
        {
            kind = "event", @event = new
            {
                id = Guid.NewGuid().ToString("N"), type = "counter",
                character = _currentName, serverId = _currentServerId,
                key = def.Key, frequency = def.Frequency, scope = def.Scope,
                current = reading.Count, maximum, occurred_at = at.ToUniversalTime().ToString("O"),
                source = "decoded"
            }
        });
    }

    public static bool TryReadCharacter(ReadOnlySpan<byte> frame, out string name, out int serverId)
    {
        name = ""; serverId = 0;
        if (frame.Length < 20 || frame[0] != 0x33 || frame[1] != 0x36) return false;
        int p = 2;
        if (!TryVarint(frame, ref p, out _)) return false;
        for (int k = p; k < Math.Min(frame.Length - 12, p + 16); k++)
        {
            int len = frame[k];
            if (len is < 2 or > 24 || k + 1 + len + 11 > frame.Length) continue;
            ReadOnlySpan<byte> bytes = frame.Slice(k + 1, len);
            if (!Utf8.IsValid(bytes)) continue;
            string candidate = Encoding.UTF8.GetString(bytes);
            if (!candidate.All(char.IsLetterOrDigit)) continue;
            int after = k + 1 + len;
            if (frame[after + 6] is not (1 or 2)) continue;
            int classCode = BinaryPrimitives.ReadInt32LittleEndian(frame[(after + 2)..]);
            int level = BinaryPrimitives.ReadInt32LittleEndian(frame[(after + 7)..]);
            if (classCode < 1 || (classCode - 1) / 4 is < 1 or > 9 || level is < 1 or > 200) continue;
            name = candidate;
            serverId = BinaryPrimitives.ReadUInt16LittleEndian(frame[after..]);
            return serverId > 0;
        }
        return false;
    }

    public static bool TryReadList(ReadOnlySpan<byte> frame, out List<TicketReading> entries)
    {
        entries = new();
        if (frame.Length < 3 || frame[0] != 0x0b || frame[1] != 0x61) return false;
        int n = frame[2];
        int p = 3;
        for (int i = 0; i < n; i++)
        {
            if (!TryReadTicket(frame, ref p, out TicketReading reading))
            {
                entries.Clear();
                return false;
            }
            entries.Add(reading);
        }
        return p == frame.Length;
    }

    public static bool TryReadUpdate(ReadOnlySpan<byte> frame, out TicketReading reading)
    {
        reading = default;
        if (frame.Length < 9 || frame[0] != 0x0c || frame[1] != 0x61) return false;
        byte flag = frame[2];
        int p = 3;
        if (!TryReadTicket(frame, ref p, out reading) || p >= frame.Length) return false;
        p++; // reason
        if ((flag & 1) != 0) p += 4; // "gained" (not an economic transaction)
        return p == frame.Length;
    }

    private static bool TryReadTicket(ReadOnlySpan<byte> frame, ref int p, out TicketReading reading)
    {
        reading = default;
        if (p + 5 > frame.Length) return false;
        byte mask = frame[p++];
        if ((mask & ~0x0f) != 0) return false;
        uint id = BinaryPrimitives.ReadUInt32LittleEndian(frame[p..]); p += 4;
        long timeMs = 0, count = 0, bonus = 0;
        if ((mask & 1) != 0)
        {
            if (p + 8 > frame.Length) return false;
            timeMs = BinaryPrimitives.ReadInt64LittleEndian(frame[p..]); p += 8;
        }
        if ((mask & 2) != 0)
        {
            if (p + 8 > frame.Length) return false;
            p += 8;
        }
        if ((mask & 4) != 0 && !TryVarint(frame, ref p, out count)) return false;
        if ((mask & 8) != 0 && !TryVarint(frame, ref p, out bonus)) return false;
        if (count is < 0 or > 1000000 || bonus is < 0 or > 1000000) return false;
        reading = new TicketReading(id, count, bonus, timeMs);
        return true;
    }

    private static bool TryVarint(ReadOnlySpan<byte> frame, ref int p, out long value)
    {
        value = 0;
        for (int shift = 0; shift <= 28 && p < frame.Length; shift += 7)
        {
            byte b = frame[p++];
            value |= ((long)b & 0x7f) << shift;
            if ((b & 0x80) == 0) return true;
        }
        return false;
    }

    /// <summary>
    /// The game represents *bound* Kinah as item 930100001 in the inventory and sends new quantities
    /// in inventory snapshots/changes. Only the observed bound-Kinah component is reported here.
    /// </summary>
    public static bool TryReadBoundKinah(ReadOnlySpan<byte> frame, out long amount)
    {
        amount = 0;
        if (frame.Length < 18) return false;
        ReadOnlySpan<byte> body = frame[2..];
        for (int i = 10; i + 14 <= body.Length; i++)
        {
            if (BinaryPrimitives.ReadUInt32LittleEndian(body[i..]) != 930100001u) continue;
            if (body[i - 10] > 2 || body[i + 9] != 0 || body[i + 10] != 0 || body[i + 11] != 0 ||
                body[i + 12] != 1) continue;
            ulong qty = BinaryPrimitives.ReadUInt64LittleEndian(body[(i + 4)..]);
            if (qty > 100000000000000UL) continue;
            amount = (long)qty;
            return true;
        }
        return false;
    }
}
