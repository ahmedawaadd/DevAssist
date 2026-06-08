# DevAssist Style Guide

A small, enforceable standard. Python-first; the language-agnostic rules apply everywhere.

## Naming
- `snake_case` for functions, methods, variables, and modules. `PascalCase` for classes. `UPPER_SNAKE_CASE` for constants.
- Names state intent: `parse_invoice`, not `do_it` or `data2`. Booleans read as predicates: `is_valid`, `has_rows`.
- No single-letter names except loop counters and conventional math (`i`, `x`, `y`).

## Functions & single responsibility
- One job per function. If you need "and" to describe it, split it.
- Target <= 30 lines and <= 4 parameters. More parameters -> pass an object/dataclass.
- Max nesting depth 3. Prefer early returns (guard clauses) over deep `if/else`.
- No side effects in functions named like queries (`get_*`, `find_*`, `is_*`).

## Type hints (Python)
- Annotate every public signature, parameters and return. Write `-> None` explicitly.
- Prefer precise types (`list[str]`, `Mapping[str, int]`) over bare `list`/`dict`/`Any`.
- Use `Optional[T]` / `T | None` deliberately, not as a dumping ground.

## Docstrings
- Every public module, class, and function has a one-line summary; expand only when behaviour isn't obvious.
- Document non-obvious parameters, return values, and raised exceptions. Don't restate type hints in prose.
- No commented-out code. Comment the "why", never the "what".

## Error handling
- Catch the narrowest exception that applies; never a bare `except:`.
- Don't swallow errors: re-raise, wrap with context, or log and handle. No empty `except` blocks.
- Validate inputs at the boundary and fail fast with a clear message.
- Use exceptions for errors and return values for results; never use exceptions for normal control flow.

## Imports
- Order: standard library, third-party, then local; separate each group with a blank line.
- Absolute imports across packages. No wildcard `from x import *`.
- No unused imports.

## Tests (Pytest)
- File `test_<module>.py`; function `test_<unit>_<scenario>` (e.g. `test_parse_invoice_rejects_empty_file`).
- One behaviour per test. Make the **Arrange -> Act -> Assert** sections visible.
- Use `@pytest.mark.parametrize` for input tables, fixtures for shared setup, and mocks for all I/O, network, time, and randomness.
- Assert on observable behaviour and raised exceptions (`pytest.raises`), not on internal implementation details.

## Avoid
- Magic numbers/strings: name them as constants.
- Mutable default arguments (`def f(x=[])`).
- Global mutable state and hidden singletons.
- Functions that both compute and perform I/O: separate the pure core from the side effects.
- Dead code, ownerless TODOs, and "clever" one-liners that hurt readability.