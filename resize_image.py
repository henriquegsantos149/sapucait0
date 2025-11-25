from PIL import Image
import os

input_path = 'data/Sapucai_Exemplo_Planta_Camarote_03.png'
output_path = 'data/Sapucai_Exemplo_Planta_Camarote_03_small.png'

try:
    with Image.open(input_path) as img:
        # Resize to max 1000px width/height, maintaining aspect ratio
        img.thumbnail((1000, 1000))
        
        # Optimize and save
        img.save(output_path, 'PNG', optimize=True)
        
        print(f"Original size: {os.path.getsize(input_path)}")
        print(f"New size: {os.path.getsize(output_path)}")
        
except Exception as e:
    print(f"Error: {e}")
