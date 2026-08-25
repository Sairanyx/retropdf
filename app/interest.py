"""How many people have opened the desktop app page.

One number, and nothing else. It says how many, never who: there is no
address, no identifier, nothing per person and nothing per visit. That is the
whole point of counting this way rather than collecting email addresses, and
the privacy page says the number exists.

It is written to a file rather than held in memory so that a restart does not
lose it. The file holds one integer and nothing more.
"""

import os
import tempfile
from pathlib import Path
from threading import Lock

# Somewhere writable that survives a restart. In production this is a mounted
# volume, so the count outlives the container it was made in.
COUNT_FILE = Path(
    os.environ.get("RETROPDF_COUNT_FILE", Path(__file__).resolve().parent.parent / "interest.count")
)

# Two people opening the page at the same moment would otherwise both read the
# old number and both write the same new one, losing a count. The server runs
# in one process, so a lock around the read and write is enough.
_lock = Lock()


def read() -> int:
    """The count so far, or zero if nobody has been yet."""
    try:
        return int(COUNT_FILE.read_text(encoding="utf-8").strip() or 0)
    except (OSError, ValueError):
        # A missing file is simply nobody yet. A corrupt one is worth not
        # crashing over either: the page matters more than the tally.
        return 0


def record() -> int:
    """Count one more visit, and say what the total now is.

    Never raises. A page that fails to load because a counter could not be
    written would be a poor trade, so a problem here costs the count and
    nothing else.
    """
    with _lock:
        total = read() + 1
        try:
            _write(total)
        except OSError:
            # Read only disk, full disk, or a path that does not exist. The
            # visit goes uncounted and the page is served regardless.
            return read()
        return total


def _write(total: int) -> None:
    """Replace the file with the new number, all at once.

    Written to a temporary file beside the real one and then moved into
    place, so a crash midway leaves the old count rather than an empty or
    half written file. The move is atomic on the same filesystem.
    """
    COUNT_FILE.parent.mkdir(parents=True, exist_ok=True)
    handle, temp = tempfile.mkstemp(dir=COUNT_FILE.parent, prefix=".count-")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as file:
            file.write(str(total))
            # On disk before the move, or the move can promote an empty file.
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp, COUNT_FILE)
    except BaseException:
        Path(temp).unlink(missing_ok=True)
        raise
