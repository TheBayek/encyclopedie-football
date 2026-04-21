import sys
try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def process_logo(img_path):
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    # Tolerance for absolute white or near-white background
    for item in datas:
        # Check if the pixel is near white
        # We increase tolerance to catch off-whites and anti-aliasing edges
        if item[0] > 230 and item[1] > 230 and item[2] > 230:
            # Change near-white to transparent
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    
    # Crop to the actual visible icon
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(img_path, "PNG")
    print("Logo successfully processed: made transparent and cropped.")

if __name__ == "__main__":
    process_logo("images/logo.png")
