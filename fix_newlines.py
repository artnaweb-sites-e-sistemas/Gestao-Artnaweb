
import os

def remove_double_newlines(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace double newlines (common in corrupted files)
    # Be careful not to destroy intentional spacing but here it seems systematically doubled
    # The view_file output showed every other line is empty
    lines = content.splitlines()
    # If more than 50% of lines are empty and they are alternating, it's definitely corrupted
    empty_count = sum(1 for line in lines if not line.strip())
    if empty_count > len(lines) * 0.4:
        print(f"Detected abnormal number of empty lines in {file_path}, fixing...")
        new_lines = []
        for i, line in enumerate(lines):
            # Keep line if it's not empty, or if previous line was not empty (allow single blank lines)
            # Actually, looking at view_file, it's exactly one empty line between every content line
            if line.strip():
                new_lines.append(line)
            elif i > 0 and lines[i-1].strip() and (i+1 < len(lines) and lines[i+1].strip()):
                # It's an empty line between two content lines, skip it
                pass
            else:
                new_lines.append(line)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
    else:
        print(f"Skipping {file_path}, empty lines seem normal.")

files_to_check = [
    r'c:\Users\biras\Desktop\Repositorio - Gestao Artnaweb\views\Dashboard.tsx',
    r'c:\Users\biras\Desktop\Repositorio - Gestao Artnaweb\views\Timeline.tsx',
    r'c:\Users\biras\Desktop\Repositorio - Gestao Artnaweb\views\ProjectDetails.tsx',
    r'c:\Users\biras\Desktop\Repositorio - Gestao Artnaweb\views\Financial.tsx'
]

for file in files_to_check:
    if os.path.exists(file):
        remove_double_newlines(file)
