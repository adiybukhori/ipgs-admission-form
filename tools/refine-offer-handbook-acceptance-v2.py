from pathlib import Path

base = Path(__file__).resolve().parent / 'refine-offer-handbook-acceptance.py'
source = base.read_text(encoding='utf-8')

# The first patch used an over-escaped literal for '.pdf' in the signed-doc
# loop regex. Correct it before executing the otherwise validated patch logic.
old = "safeName \\\\+ '\\\\\\\\.pdf'"
new = "safeName \\\\+ '\\\\.pdf'"
if old not in source:
    raise SystemExit('Unable to locate signed-loop regex escape to correct.')
source = source.replace(old, new, 1)

namespace = {
    '__file__': str(base),
    '__name__': '__main__',
}
exec(compile(source, str(base), 'exec'), namespace, namespace)
