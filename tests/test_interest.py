"""The desktop app counter.

One number that survives a restart, counts every visit once, and never takes
the page down with it when the disk will not cooperate.
"""

import os
from pathlib import Path

import pytest

from app import interest


@pytest.fixture(autouse=True)
def count_file(tmp_path, monkeypatch):
    """Point the counter at a fresh file for every test."""
    path = tmp_path / "interest.count"
    monkeypatch.setattr(interest, "COUNT_FILE", path)
    return path


def test_starts_at_zero(count_file):
    assert interest.read() == 0


def test_counts_each_visit():
    assert interest.record() == 1
    assert interest.record() == 2
    assert interest.record() == 3


def test_survives_a_restart(count_file):
    interest.record()
    interest.record()
    # A restart is simply reading the file again, which is what read() does.
    assert interest.read() == 2


def test_writes_only_the_number(count_file):
    interest.record()
    assert count_file.read_text(encoding="utf-8").strip() == "1"


def test_a_corrupt_file_does_not_crash(count_file):
    count_file.write_text("not a number", encoding="utf-8")
    assert interest.read() == 0
    # And counting from there still works rather than raising.
    assert interest.record() == 1


def test_an_empty_file_reads_as_nobody(count_file):
    count_file.write_text("", encoding="utf-8")
    assert interest.read() == 0


def test_a_write_failure_does_not_raise(count_file, monkeypatch):
    """The page matters more than the tally."""

    def refuse(_total):
        raise OSError("read only disk")

    monkeypatch.setattr(interest, "_write", refuse)
    # No exception, and the count simply does not go up.
    assert interest.record() == 0


def test_leaves_no_temporary_files_behind(count_file):
    interest.record()
    interest.record()
    leftovers = [p.name for p in count_file.parent.iterdir() if p.name.startswith(".count-")]
    assert leftovers == []


def test_concurrent_visits_are_all_counted(count_file):
    """Two people opening the page at once must not lose a count."""
    from threading import Thread

    threads = [Thread(target=interest.record) for _ in range(50)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert interest.read() == 50
