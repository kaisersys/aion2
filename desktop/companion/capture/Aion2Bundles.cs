using System.Buffers.Binary;

namespace AtreiaCapture;

/// <summary>
/// Expands Aion 2 0xFFFF LZ4 bundles into complete inner game frames.
/// Format: [0xFF,0xFF] [uncompressed-size:u32le] [raw LZ4 block].
/// The decompressed bytes contain normal LEB128 length-prefixed game records:
/// record size = declared varint length + prefix bytes - 4.
/// No recursion, no raw recording, bounded memory and output counts.
/// </summary>
public static class Aion2Bundles
{
    public const int BundleOpcode = 0xffff;
    public const int MaxInnerFrames = 1024;

    public static bool TryExpand(ReadOnlyMemory<byte> outer, out List<ReadOnlyMemory<byte>> frames)
    {
        frames = new();
        var body = outer.Span;
        if (body.Length <= 6 || body[0] != 0xff || body[1] != 0xff) return false;
        uint expected = BinaryPrimitives.ReadUInt32LittleEndian(body[2..6]);
        if (expected < 3 || expected > Aion2Lz4.MaxOutput ||
            !Aion2Lz4.TryDecompress(body[6..], (int)expected, out byte[] decompressed))
            return false;

        int offset = 0;
        while (offset < decompressed.Length)
        {
            if (frames.Count >= MaxInnerFrames) { frames.Clear(); return false; }
            long declared = 0;
            int prefix = 0;
            bool complete = false;
            for (; prefix < 5 && offset + prefix < decompressed.Length; prefix++)
            {
                byte v = decompressed[offset + prefix];
                declared |= (long)(v & 0x7f) << (7 * prefix);
                if ((v & 0x80) == 0) { prefix++; complete = true; break; }
            }
            if (!complete || declared > Aion2Lz4.MaxOutput)
            {
                frames.Clear(); return false;
            }
            long total = declared + prefix - 4;
            if (total < prefix + 2 || total > decompressed.Length - offset)
            {
                frames.Clear(); return false;
            }
            int payloadStart = offset + prefix;
            int payloadSize = (int)total - prefix;
            // Bundles sometimes include zero-length padding: reject malformed bodies
            // rather than forwarding spurious opcodes to the character decoder.
            if (payloadSize < 2) { frames.Clear(); return false; }
            frames.Add(decompressed.AsMemory(payloadStart,payloadSize));
            offset += (int)total;
        }
        if (offset != decompressed.Length || frames.Count == 0)
        {
            frames.Clear(); return false;
        }
        return true;
    }
}
