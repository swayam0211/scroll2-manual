import os
import glob
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

def process_relics(input_dir="upgrade", output_dir="assets/relics"):
    """
    Scans the input directory for image files, removes the solid background,
    and saves them as transparent PNGs in the output directory.
    """
    # Create the output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize the rembg session to reuse models and optimize processing
    session = new_session("u2net")

    # Target jpg and png image formats
    valid_extensions = ('.png', '.jpg', '.jpeg')
    image_paths = []
    
    for ext in valid_extensions:
        image_paths.extend(glob.glob(os.path.join(input_dir, f"*{ext}")))
        image_paths.extend(glob.glob(os.path.join(input_dir, f"*{ext.upper()}")))

    if not image_paths:
        print(f"No images found in '{input_dir}'. Ensure the folder exists and has images.")
        return

    print(f"Found {len(image_paths)} images. Processing...")

    for path in image_paths:
        file_name = Path(path).stem
        output_path = os.path.join(output_dir, f"{file_name}.png")
        
        try:
            print(f"Removing background from: {Path(path).name}...")
            
            # Open the image with Pillow
            with Image.open(path) as input_image:
                # Remove the background using rembg
                output_image = remove(input_image, session=session)
                
                # Save as a perfectly transparent PNG
                output_image.save(output_path, "PNG")
                
            print(f"Successfully saved transparent image to: {output_path}")
            
        except Exception as e:
            print(f"Error processing {file_name}: {e}")

if __name__ == "__main__":
    process_relics()
