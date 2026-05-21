from PIL import Image
import sys

# Usage: python make_transparent.py input.png output.png [threshold]

def make_transparent(in_path, out_path, thresh=30):
    im = Image.open(in_path).convert('RGBA')
    datas = im.getdata()
    new_data = []
    for item in datas:
        r,g,b,a = item
        if r < thresh and g < thresh and b < thresh:
            # make transparent
            new_data.append((255,255,255,0))
        else:
            new_data.append((r,g,b,a))
    im.putdata(new_data)
    im.save(out_path, 'PNG')

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: make_transparent.py input.png output.png [threshold]')
        sys.exit(1)
    inp = sys.argv[1]
    outp = sys.argv[2]
    t = int(sys.argv[3]) if len(sys.argv) > 3 else 30
    make_transparent(inp, outp, t)
    print('Saved', outp)
