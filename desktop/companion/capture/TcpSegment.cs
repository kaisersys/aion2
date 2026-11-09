namespace AtreiaCapture;
public sealed record TcpSegment(
    DateTime Timestamp,
    string Source,
    string Destination,
    uint Sequence,
    ReadOnlyMemory<byte> Payload,
    bool FromServer)
{
    public string StreamKey => Source + ">" + Destination;
}
