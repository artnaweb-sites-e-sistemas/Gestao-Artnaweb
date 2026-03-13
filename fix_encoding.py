
import os

def fix_encoding(file_path):
    with open(file_path, 'rb') as f:
        content = f.read()
    
    # Try to decode from UTF-8
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        # Fallback to Latin-1 if it's not valid UTF-8
        text = content.decode('latin-1')

    # Common corrupted patterns in the project
    replacements = {
        'Manuten??o': 'Manutenção',
        'ManutenÃ§Ã£o': 'Manutenção',
        'Relat?rio': 'Relatório',
        'RelatÃ³rio': 'Relatório',
        'ConcluÃ­do': 'Concluído',
        'Concluído': 'Concluído',
        'RecorrÃªncia': 'Recorrência',
        'atividades': 'atividades',
        'especÃ­fica': 'específica',
        'disponÃ­vel': 'disponível',
        'tÃ­tulo': 'título',
        'Pend?ncia': 'Pendência',
        'PendÃªncia': 'Pendência',
        'ConfiguraÃ§Ãµes': 'Configurações',
        'atualizaÃ§Ãµes': 'atualizações',
        'preferÃªncia': 'preferência',
        'concluÃ­dos': 'concluídos',
        'especÃ­fico': 'específico',
        'consistÃªncia': 'consistência',
        'Ã©': 'é',
        'Ã¡': 'á',
        'Ã³': 'ó',
        'Ã£': 'ã',
        'Ã§': 'ç',
        'Ãª': 'ê',
        'Ã­': 'í',
        'Ã€': 'À',
        'âœ…': '✅',
        'âš ï¸ ': '⚠️',
        '🆕': '🆕',
        'ðŸ“ ': '📂',
        'ðŸ“¦': '📦',
        'ðŸ”„': '🔄',
        'ðŸ ·ï¸ ': '🏷️',
        'ðŸ’°': '💰',
        'ðŸ’¡': '💡',
        'ðŸ†•': '🆕',
        'â Œ': '❌',
        'â ­ï¸ ': '⭐',
        'âœ–': '✖️',
        'Â ': ' ', # Non-breaking space often corrupted
        'Âª': 'ª', # Indicador ordinal feminino (ex: 1ª Fatura)
    }

    original_text = text
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    if text != original_text:
        print(f"Fixed encoding issues in {file_path}")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(text)
    else:
        print(f"No changes needed for {file_path}")

files_to_fix = [
    r'c:\Users\biras\Desktop\Repositorio - Gestao Artnaweb\views\Dashboard.tsx',
    r'c:\Users\biras\Desktop\Repositorio - Gestao Artnaweb\views\Timeline.tsx',
    r'c:\Users\biras\Desktop\Repositorio - Gestao Artnaweb\views\ProjectDetails.tsx',
    r'c:\Users\biras\Desktop\Repositorio - Gestao Artnaweb\views\Financial.tsx'
]

for file in files_to_fix:
    if os.path.exists(file):
        fix_encoding(file)
    else:
        print(f"File not found: {file}")
