---
title: Broken File
category: Misc
difficulty: Easy
description: Unwrapping 1,001 nested archives and repairing a one-byte PNG signature to recover the flag.
---

## The challenge

> Our picture is broken but we're not sure why. We archived it up to keep it from breaking even more.

- **Creator:** jdb_jdb
- **Score:** 500
- **Provided file:** `1000.tar.gz`

I needed to recover the picture and find the flag. Before investigating the image itself, I had to get through its packaging.

## Following the archive chain

I started by checking the file type and listing the archive's contents:

```bash
file 1000.tar.gz
tar -tzf 1000.tar.gz
```

`file` identified gzip-compressed data. The manual archive listing showed just `999.tar.gz`, rather than an image. That established at least one nested archive; the descending name suggested a chain, but did not establish its depth or contents.

The two parts of `.tar.gz` describe different jobs. TAR packages file contents and metadata, including member names, into an archive. GZIP compresses that archive's byte stream. Decompressing GZIP therefore reveals a TAR archive, not necessarily the file I ultimately want. Here, the TAR member was another complete gzip-compressed TAR archive. [GNU's Gzip manual](https://www.gnu.org/software/gzip/manual/gzip.html) describes the two tools as complementary.

The initial listing suggested a repeatable operation: inspect the current archive, then check whether its contents are another archive. I originally followed the chain programmatically and later shortened the script using the known depth. The version below is a retrospective improvement: it discovers the stopping point instead of encoding the answer. It is not a claim that I used this exact script during the original investigation.

## Discovering where the chain ends

I use the single-member structure from the initial listing as a condition to check at each layer, not an assumption about every archive. A filename ending in `.tar.gz` is only a clue, so the script attempts to open the member's bytes as a TAR archive before continuing.

Run this with Python 3.12 or later, from the directory containing `1000.tar.gz`:

```python
import io
import tarfile
from pathlib import Path

data = Path("1000.tar.gz").read_bytes()
output = Path("broken-file-output")
depth = 0

while True:
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:*") as archive:
        members = archive.getmembers()

        if len(members) == 1 and members[0].isfile():
            candidate = archive.extractfile(members[0]).read()
            try:
                with tarfile.open(fileobj=io.BytesIO(candidate), mode="r:*"):
                    pass
            except tarfile.ReadError:
                pass  # A single non-archive file also ends the chain.
            else:
                data = candidate
                depth += 1
                continue

        output.mkdir()  # Refuse to overwrite an existing output directory.
        archive.extractall(output, filter="data")
        print(f"Unwrapped {depth} nested layers")
        for member in members:
            print(member.name)
        break
```

[`io.BytesIO`](https://docs.python.org/3/library/io.html#io.BytesIO) gives the current bytes a file-like interface, including reading and seeking. [`tarfile`'s `r:*` mode](https://docs.python.org/3/library/tarfile.html#tarfile.open) reads TAR archives with automatic compression detection. Together, they let me inspect the next layer without saving every intermediate archive to disk.

The loop continues only when there is exactly one regular-file member and its contents open as another TAR archive. Otherwise, it keeps the current archive open and extracts its members. That matters for the final layer: I want to preserve all its contents, not select the first file and discard the rest. `depth` counts successful transitions into nested archives, excluding the final extraction.

The fresh output directory avoids replacing an earlier run's files. The `data` extraction filter rejects unsafe paths and some dangerous member types; it does not make arbitrary archives harmless. This remains a tool for following a single chain: multiple members, including a directory entry alongside an archive, stop traversal for inspection. It reads candidate members fully into memory and has no resource limits. For larger or untrusted inputs, I would add size and depth limits before using it.

Running this revised script on the supplied file produces:

```text
Unwrapped 1001 nested layers
challenge.png
message.txt
```

The traversal reaches `folder.tar.gz` after the numbered wrappers from `1000.tar.gz` through `0.tar.gz`. Its two members end the single-file chain, and both are saved into `broken-file-output/`. Their names come from the archive listing, not the script.

The recovered `message.txt` brings the investigation back to the picture:

> Please you could you help me? My image is broken and I don't know why

## A PNG by name, but not by signature

Despite its `.png` extension, `file` identified `challenge.png` only as `data`. The filename suggested a format, but the identification result did not confirm it. That made the header worth inspecting before changing anything:

```bash
file broken-file-output/challenge.png
xxd -l 16 broken-file-output/challenge.png
```

```text
00000000: 8950 4e4a 0d0a 1a0a 0000 000d 4948 4452  .PNJ........IHDR
```

An extension is a label in the filename; renaming a file does not change its contents. The [`file` utility](https://github.com/file/file/blob/master/doc/file.man) uses content tests, including recognisable byte patterns, to identify formats. Its generic `data` result did not establish that the image data was destroyed, only that it had not recognised a more specific type.

The first eight bytes here are `89 50 4e 4a 0d 0a 1a 0a`. The [PNG specification](https://www.w3.org/TR/png/#5PNG-file-signature) requires `89 50 4e 47 0d 0a 1a 0a`. At zero-based offset 3, this file has `4a` (`J`) where it should have `47` (`G`): `PNJ` instead of `PNG`.

There was supporting evidence immediately after the signature. `00 00 00 0d` represents a 13-byte chunk payload, followed by `49 48 44 52`, or `IHDR`. PNG begins with an IHDR chunk containing the dimensions, bit depth, colour type, and decoding parameters. That layout matched the [specified image header](https://www.w3.org/TR/png/#11IHDR), making a damaged PNG signature a much stronger explanation than a misleading extension alone.

This still did not prove that the remaining chunks were intact. It gave me a precise, minimal change to test.

## Repairing one byte

```python
from pathlib import Path

output = Path("broken-file-output")
data = bytearray((output / "challenge.png").read_bytes())
assert data[:8] == b"\x89PNJ\r\n\x1a\n"

data[3] = 0x47
(output / "fixed.png").write_bytes(data)
```

`bytearray` lets me change the byte at offset 3 without altering the rest of the file. The assertion checks that the input has the exact damaged signature I inspected. I then save a separate copy, preserving the original for comparison.

This repairs format recognition, not pixel data. PNG's signature sits before its chunks; changing it leaves their contents and CRCs untouched. A valid signature alone would not repair damaged image data, so the useful test was whether the resulting file actually decoded.

## Result

The repaired copy opened successfully as a 527 × 367 image, with the flag written across a coloured background. That confirmed that the single-byte repair was sufficient for this file.

[View the repaired image](../../../assets/ctf/warwick-cybersoc-gym/broken-file/fixed.png){target="_blank"}

```text
WMG{h0W_d1d_th3_pnG_brEAk}
```

## Takeaway

The useful distinction here was between packaging, identification, and image content. The archives could be unpacked correctly while carrying a broken file. The `.png` name could be correct about the intended format while its signature prevented recognition. Neither observation, by itself, said whether the pixels were recoverable.

Binary inspection narrowed the problem to one specific mismatch. Keeping the original, changing only the byte supported by the evidence, and checking the decoded result made the repair easy to verify. The same approach would guide a harder case: if the signature fix had not worked, I would move on to chunk lengths, CRCs, and decoder errors rather than making more speculative edits.
