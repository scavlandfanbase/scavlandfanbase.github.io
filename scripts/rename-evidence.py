#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,shutil
ROOT=Path("evidence-inbox"); MAP_FILE=Path("evidence-rename-map.json")
def sha256(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  for b in iter(lambda:f.read(1048576),b""): h.update(b)
 return h.hexdigest()
def main():
 mapping=json.loads(MAP_FILE.read_text(encoding="utf-8")); moved=0
 for old,new in mapping.items():
  src=Path(old); dst=Path(new)
  if not src.exists():
   if dst.exists(): continue
   raise SystemExit(f"Missing source: {src}")
  dst.parent.mkdir(parents=True,exist_ok=True)
  if dst.exists():
   if sha256(src)==sha256(dst): src.unlink(); continue
   raise SystemExit(f"Collision: {dst}")
  shutil.move(str(src),str(dst)); moved+=1
 groups={}
 for p in ROOT.rglob("*"):
  if p.is_file(): groups.setdefault(sha256(p),[]).append(p)
 removed=0
 for paths in groups.values():
  if len(paths)<2: continue
  paths.sort(key=lambda p:((" - Copy" in p.name),len(p.name),str(p)))
  for p in paths[1:]: p.unlink(); removed+=1
 print(f"Moved {moved}; removed {removed} byte-identical duplicates")
if __name__=="__main__": main()
