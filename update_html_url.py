import re

file_path = r"c:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\index.html"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = re.sub(
    r"var CF_API_URL = '[^']*';",
    "var CF_API_URL = 'https://bigenergyco-api.bigenergyco.workers.dev';",
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Updated index.html CF_API_URL to https://bigenergyco-api.bigenergyco.workers.dev")
