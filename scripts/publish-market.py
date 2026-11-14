#!/usr/bin/env python3
"""Upload only complete market snapshots via explicit, encrypted FTPS.

Unlike full-directory sync tools, this NEVER removes an existing remote file.
Failed provider requests therefore leave that server's last snapshot unchanged.
"""
import json
import os
import re
import ssl
from ftplib import FTP_TLS, error_perm
from pathlib import Path

ROOT = Path("market-data")
INDEX = ROOT / "servers.json"

def main():
    if not INDEX.is_file():
        raise RuntimeError("No successful market sync: servers.json is missing")
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    successful_ids = index.get("successful_server_ids", [])
    if not successful_ids:
        raise RuntimeError("Refusing to publish: no successfully refreshed servers")
    if len(successful_ids) != len(set(successful_ids)):
        raise RuntimeError("Duplicate server IDs in market index")

    snapshots = []
    for server_id in successful_ids:
        if not isinstance(server_id, int) or server_id <= 10000:
            raise RuntimeError("Invalid server ID in market index")
        snapshot = ROOT / f"{server_id}.json"
        if not snapshot.is_file():
            raise RuntimeError(f"Missing completed snapshot: {snapshot}")
        data = json.loads(snapshot.read_text(encoding="utf-8"))
        if data.get("server_id") != server_id or not isinstance(data.get("items"), list) or len(data["items"]) < 5:
            raise RuntimeError(f"Invalid completed snapshot: {snapshot}")
        snapshots.append(snapshot)

    host = os.environ["FTP_HOST"].strip()
    user = os.environ["FTP_USER"]
    password = os.environ["FTP_PASSWORD"]
    remote_root = os.environ["FTP_REMOTE_DIR"].strip().rstrip("/")
    if not host or not remote_root or remote_root in {".", "/"}:
        raise RuntimeError("Unsafe or missing FTPS host/destination")

    # Verify the host's TLS certificate and encrypt both control and data connections.
    with FTP_TLS(context=ssl.create_default_context(), timeout=45) as ftp:
        ftp.connect(host=host, port=21)
        ftp.login(user=user, passwd=password)
        ftp.prot_p()
        ftp.cwd(remote_root)
        try:
            ftp.cwd("market-data")
        except error_perm:
            ftp.mkd("market-data")
            ftp.cwd("market-data")
        for position, path in enumerate(snapshots, 1):
            with path.open("rb") as source:
                ftp.storbinary(f"STOR {path.name}", source, blocksize=131072)
            if position % 12 == 0 or position == len(snapshots):
                print(f"Published {position}/{len(snapshots)} complete market snapshots", flush=True)
        # Publish catalog last so a failed upload does not advertise incomplete changes.
        with INDEX.open("rb") as source:
            ftp.storbinary("STOR servers.json", source, blocksize=131072)
    print(f"MARKET_PUBLISH_OK updated={len(snapshots)} skipped={len(index.get('failed_server_ids', []))}")

if __name__ == "__main__":
    main()
