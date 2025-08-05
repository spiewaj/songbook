import os
import io
import textwrap
from PIL import Image, ImageDraw, ImageFont
import cairosvg

package_directory = os.path.dirname(os.path.abspath(__file__))

def img2cover(
    logo_path: str,
    title: str,
    output_path: str,
    subtitle: str = None,
    date: str = None,
    font_path_title: str = 'NotoSans-Bold.ttf',
    font_path_subtitle: str = 'NotoSans-Regular.ttf',
    font_path_date: str = 'NotoSans-Italic.ttf',
    dpi: int = 300,
    text_color: tuple = (0, 0, 0), # Black for readability on white
    shadow_color: tuple = (150, 150, 150) # Light gray for a subtle shadow
):
    """
    Generates a white A5 book cover with a logo and text overlays,
    raising exceptions on failure.

    This version includes automatic text wrapping, font scaling, and robust error handling.

    Args:
        logo_path (str): Path to the logo image (PNG or SVG).
        title (str): The main title of the book. Can be very long.
        output_path (str): Path to save the final PNG cover image.
        subtitle (str, optional): The subtitle.
        date (str, optional): The date or edition info.
        font_path_title (str, optional): Path to a .ttf font supporting all needed characters.
        font_path_subtitle (str, optional): Path to a font for the subtitle.
        font_path_date (str, optional): Path to a font for the date.
        dpi (int, optional): Dots per inch for the output image. Defaults to 300.
        text_color (tuple, optional): RGB tuple for the main text color.
        shadow_color (tuple, optional): RGB tuple for the text shadow color.

    Raises:
        FileNotFoundError: If the logo or a font file cannot be found.
        ValueError: If the logo format is unsupported or another processing error occurs.
        Exception: For other potential errors during image processing.
    """
    # 1. Define A5 dimensions in pixels
    A5_WIDTH_MM = 148
    A5_HEIGHT_MM = 210
    INCH_TO_MM = 25.4
    
    width_px = int((A5_WIDTH_MM / INCH_TO_MM) * dpi)
    height_px = int((A5_HEIGHT_MM / INCH_TO_MM) * dpi)
    
    # 2. Create a blank white A5 canvas
    cover = Image.new('RGB', (width_px, height_px), color='white')
    draw = ImageDraw.Draw(cover)
    
    # 3. Helper function to draw text with wrapping, scaling, and shadow
    def draw_smart_text(position, text, base_font_path, initial_size, max_width, max_height):
        x, y = position
        
        try:
            font_size = initial_size
            font = ImageFont.truetype(os.path.join(package_directory, base_font_path), font_size)
        except IOError:
            raise FileNotFoundError(f"Font file not found or cannot be opened: {base_font_path}")

        # Reduce font size until the text fits within the max height
        while font_size > 10:
            avg_char_width = sum(font.getlength(c) for c in 'abcdefghijklmnopqrstuvwxyz') / 26
            wrap_width = int(max_width / avg_char_width) if avg_char_width > 0 else 20
            
            lines = textwrap.wrap(text, width=wrap_width)
            wrapped_text = '\n'.join(lines)
            
            text_bbox = draw.textbbox((0, 0), wrapped_text, font=font)
            text_height = text_bbox[3] - text_bbox[1]

            if text_height <= max_height:
                break
            
            font_size -= 5
            font = ImageFont.truetype(os.path.join(package_directory, base_font_path), font_size)
        
        # Center the text block and draw it
        text_bbox = draw.textbbox((0, 0), wrapped_text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        
        text_x = (width_px - text_width) / 2
        text_y = y + (max_height - text_height) / 2

        draw.text((text_x + 3, text_y + 3), wrapped_text, font=font, fill=shadow_color, align='center')
        draw.text((text_x, text_y), wrapped_text, font=font, fill=text_color, align='center')
        
        return y + max_height

    # 4. Define layout areas and draw text
    margin = int(height_px * 0.08)
    title_area_y_start = margin
    title_area_height = int(height_px * 0.25)
    title_max_width = width_px - (2 * margin)
    
    last_y = draw_smart_text((margin, title_area_y_start), title, font_path_title, int(height_px * 0.1), title_max_width, title_area_height)

    if subtitle:
        subtitle_area_height = int(height_px * 0.1)
        last_y = draw_smart_text((margin, last_y), subtitle, font_path_subtitle, int(height_px * 0.04), title_max_width, subtitle_area_height)

    # 5. Load, resize, and position the logo
    try:
        if not os.path.exists(logo_path):
            raise FileNotFoundError(f"The logo file was not found at '{logo_path}'")

        if logo_path.lower().endswith('.svg'):
            png_data = cairosvg.svg2png(url=logo_path)
            logo_img = Image.open(io.BytesIO(png_data))
        elif logo_path.lower().endswith(('.png', '.jpg', '.jpeg')):
            logo_img = Image.open(logo_path)
        else:
            raise ValueError(f"Unsupported logo format: {os.path.basename(logo_path)}. Please use PNG, JPG, or SVG.")

        logo_area_y_start = last_y
        logo_area_height = height_px - logo_area_y_start - (margin * 2)
        logo_max_width = width_px * 0.7
        
        logo_img.thumbnail((logo_max_width, logo_area_height), Image.Resampling.LANCZOS)
        
        logo_x = (width_px - logo_img.width) / 2
        logo_y = logo_area_y_start + (logo_area_height - logo_img.height) / 2
        
        cover.paste(logo_img, (int(logo_x), int(logo_y)), logo_img.convert('RGBA'))
        last_y = logo_y + logo_img.height

    except Exception as e:
        # Re-raise exceptions to be handled by the caller
        raise e

    # 6. Position and draw the date (if provided)
    if date:
        try:
            date_font = ImageFont.truetype(os.path.join(package_directory, font_path_date), int(height_px * 0.03))
        except IOError:
            raise FileNotFoundError(f"Date font file not found or cannot be opened: {font_path_date}")

        date_bbox = draw.textbbox((0, 0), date, font=date_font)
        date_width = date_bbox[2] - date_bbox[0]
        date_x = (width_px - date_width) / 2
        date_y = height_px - margin
        
        draw.text((date_x + 2, date_y + 2), date, font=date_font, fill=shadow_color)
        draw.text((date_x, date_y), date, font=date_font, fill=text_color)

    # 7. Save the final image
    cover.save(output_path, 'PNG', dpi=(dpi, dpi))

if __name__ == '__main__':
    # --- USAGE EXAMPLE ---

    # 1. Create a placeholder logo if it doesn't exist.
    #    Replace 'my_logo.png' with your actual logo file.
    if not os.path.exists('my_logo.png'):
        print("Creating a placeholder 'my_logo.png'...")
        logo_size = 400
        placeholder_logo = Image.new('RGBA', (logo_size, logo_size), (0,0,0,0))
        draw_logo = ImageDraw.Draw(placeholder_logo)
        # Draw a simple shape (e.g., a circle with a gradient-like effect)
        draw_logo.ellipse([(20, 20), (logo_size-20, logo_size-20)], fill='#283593')
        draw_logo.ellipse([(60, 60), (logo_size-60, logo_size-60)], fill='#3949ab')
        draw_logo.ellipse([(100, 100), (logo_size-100, logo_size-100)], fill='#5c6bc0')
        placeholder_logo.save('my_logo.png')

    # 2. Define your book's details.
    book_title = "The Gemini\nChronicles"
    book_subtitle = "A Tale of Code and Creation"
    book_date = f"First Edition - August {2025}"
    
    # 3. Specify paths.
    logo_file = 'my_logo.png' 
    output_file = 'final_book_cover_with_logo.png'
    
    # Font files (must be in the same directory or provide full path)
    title_font_file = 'Merriweather-Bold.ttf' 
    subtitle_font_file = 'Lato-Regular.ttf'
    date_font_file = 'Lato-Italic.ttf'

    # Check if fonts exist before running
    if not all(os.path.exists(f) for f in [title_font_file, subtitle_font_file, date_font_file]):
        print("\n---")
        print("WARNING: FONT FILES NOT FOUND.")
        print("Please download 'Merriweather-Bold.ttf', 'Lato-Regular.ttf', and 'Lato-Italic.ttf'")
        print("from Google Fonts (https://fonts.google.com/) and place them in the script's directory.")
        print("---\n")
    else:
        # 4. Generate the cover.
        cover2img(
            logo_path=logo_file,
            title=book_title,
            subtitle=book_subtitle,
            date=book_date,
            output_path=output_file,
            font_path_title=title_font_file,
            font_path_subtitle=subtitle_font_file,
            font_path_date=date_font_file
        )