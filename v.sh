sha256sum -c <(python -c "import json,sys;d=json.load(open('baseline.json'));sys.stdout.write(''.join(f"{e['sha256']}  {e['path']}\n" for e in d['manifest']['files']))" | tr -d '\r')
