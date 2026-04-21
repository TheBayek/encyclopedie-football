import urllib.request
import os

images_dir = "c:/Users/mehme/Desktop/asasasasasas/images"
os.makedirs(images_dir, exist_ok=True)

image_urls = {
    'history_real.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/The_first_international_association_football_match.jpg/800px-The_first_international_association_football_match.jpg',
    'stadium_real.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Camp_Nou_panoramic_interior_view.jpg/1200px-Camp_Nou_panoramic_interior_view.jpg',
    'player_real.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Messi_vs_Nigeria_2018.jpg/800px-Messi_vs_Nigeria_2018.jpg',
    'news_real.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/A_ball_on_the_field.jpg/800px-A_ball_on_the_field.jpg',
    'fans_real.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Borussia_Dortmund_fans_2013.jpg/800px-Borussia_Dortmund_fans_2013.jpg'
}

for name, url in image_urls.items():
    print(f"Téléchargement de {name}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(os.path.join(images_dir, name), 'wb') as out_file:
            out_file.write(response.read())
        print(f"{name} téléchargé !")
    except Exception as e:
        print(f"Erreur avec {name} : {e}")

print("Tous les téléchargements sont terminés.")
