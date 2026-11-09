namespace AtreiaCapture;
// Framing verified in community captures: varint LEB128; total = prefix + length - 4.
// A large login frame may exceed the regular combat-frame bound.
public sealed record FrameLayout(
    int LengthOffset = 0, int LengthSize = 2, bool LittleEndian = true,
    bool LengthIncludesHeader = true, int HeaderSize = 2, int OpcodeOffset = 0,
    int OpcodeSize = 2, int MaxFrameLength = 262144,
    string LengthEncoding = "varint", int LengthBias = -4, bool OpcodeBigEndian = true)
{
    public bool IsVarint => LengthEncoding == "varint";
}
