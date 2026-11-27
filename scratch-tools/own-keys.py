# python3 out/work/p6s/own-keys.py <tree>: every `x in y` outside a comment, a string and a loop's head, and every lookup
# `name[key]` whose key reads as a name (not a number, not a counter), in src/ of that tree. For reading by a person.
import re, sys, os
tree = sys.argv[1]
COUNTERS = set('i j k n m a b c d e f g h l o p q r s t u v w x y z at idx index ix iy iz ii jj kk row col side axis lane cell step slot face tri vert seg ring band octave pass level0'.split())
def strip(src):
    out = []; i = 0; n = len(src)
    while i < n:
        c = src[i]; two = src[i:i+2]
        if two == '//':
            j = src.find('\n', i); j = n if j < 0 else j; i = j; continue
        if two == '/*':
            j = src.find('*/', i + 2); j = n if j < 0 else j + 2
            out.append(re.sub(r'[^\n]', ' ', src[i:j])); i = j; continue
        if c in '\'"`':
            j = i + 1
            while j < n and src[j] != c:
                if src[j] == '\\': j += 1
                j += 1
            body = src[i+1:j]
            out.append(c + re.sub(r'[^\n]', '_', body) + c); i = j + 1; continue
        out.append(c); i += 1
    return ''.join(out)
found = []
for root, _, files in os.walk(os.path.join(tree, 'src')):
    for f in files:
        if not f.endsWith('.ts') if False else not f.endswith('.ts'): continue
        p = os.path.join(root, f); rel = os.path.relpath(p, tree)
        raw = open(p).read(); code = strip(raw)
        rawl = raw.split('\n')
        for k, line in enumerate(code.split('\n')):
            for m in re.finditer(r'[\w)\]\'"`]\s+in\s+[\w(]', line):
                head = line[:m.start() + 1]
                if re.search(r'for\s*\(\s*(const|let|var)\s+[\w\[\], ]+$', head): continue
                if re.search(r'\[\s*\w+$', head) and re.search(r'^\s*in\s+(keyof|typeof|string|[A-Z])', line[m.start()+1:]) : continue
                found.append(f'{rel}:{k+1}: in   {rawl[k].strip()[:150]}')
            for m in re.finditer(r'([A-Za-z_][\w.]*(?:\([^()]*\))?(?: as [^\]\[]*?\))?)\[([A-Za-z_][\w.!]*)\]', line):
                key = m.group(2).rstrip('!')
                last = key.split('.')[-1]
                if last in COUNTERS or re.fullmatch(r'[a-z]\d?', last) or last.isupper() and len(last) < 3: continue
                found.append(f'{rel}:{k+1}: [..] {m.group(0)[:70]}   | {rawl[k].strip()[:110]}')
print('\n'.join(found)); print(len(found), 'places')
