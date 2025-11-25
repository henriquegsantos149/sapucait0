from PIL import Image
import os

input_path = 'data/Sapucai_Exemplo_Planta_Camarote_03.png'
output_path = 'data/Sapucai_Exemplo_Planta_Camarote_03_optimized.png'

try:
    with Image.open(input_path) as img:
        # Resize if too huge (optional, but 1938x2113 is fine, maybe just compression)
        # img.thumbnail((1024, 1024)) # Uncomment to resize if needed
        
        # Optimize and save
        img.save(output_path, 'PNG', optimize=True, quality=80)
        
        print(f"Original size: {os.path.getsize(input_path)}")
        print(f"Optimized size: {os.path.getsize(output_path)}")
        
except Exception as e:
    print(f"Error: {e}")
