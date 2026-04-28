const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.startsWith('page') && f.endsWith('.html'));

let fixedCount = 0;

for (const file of files) {
    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Extraire le content-body
    const bodyRegex = /<div class="content-body" style="text-align: justify;">([\s\S]*?)<\/div>\s*<div class="pagination-footer"/;
    const match = content.match(bodyRegex);
    
    if (match) {
        let innerHtml = match[1];
        
        // Séparer les balises racines (div, p, h3, blockquote)
        // On utilise une astuce simple : on split par < et on reconstruit
        // Ou mieux : on utilise regex pour trouver tous les blocs
        const blockRegex = /(<div[^>]*>.*?<\/div>|<p[^>]*>.*?<\/p>|<h3>.*?<\/h3>|<blockquote[^>]*>.*?<\/blockquote>)/gs;
        
        const blocks = [...innerHtml.matchAll(blockRegex)].map(m => m[0]);
        
        const seenBlocks = new Set();
        let newInnerHtml = '';
        
        for (let block of blocks) {
            // Nettoyer le block pour la comparaison (enlever les styles/espaces)
            let cleanBlock = block.replace(/style="[^"]*"/g, '').replace(/\s+/g, ' ').trim();
            
            // Traiter spécialement "Point Historique n°2" etc.
            if (cleanBlock.includes('Point Historique n°2')) {
                const generic2 = `L'évolution de ces pratiques a profondément marqué les générations suivantes, prouvant que l'innovation tactique et structurelle reste la clé du succès à long terme.`;
                block = `<p><strong>Impact Stratégique :</strong> ${generic2}</p>`;
                cleanBlock = block.replace(/style="[^"]*"/g, '').replace(/\s+/g, ' ').trim();
            } else if (cleanBlock.includes('Observation Complémentaire')) {
                const generic3 = `Aujourd'hui encore, les observateurs s'accordent à dire que cet héritage est une pierre angulaire incontournable pour comprendre les dynamiques actuelles du sport de haut niveau.`;
                block = `<p><strong>Héritage Moderne :</strong> ${generic3}</p>`;
                cleanBlock = block.replace(/style="[^"]*"/g, '').replace(/\s+/g, ' ').trim();
            }

            if (!seenBlocks.has(cleanBlock)) {
                seenBlocks.add(cleanBlock);
                newInnerHtml += block;
            }
        }

        content = content.replace(match[1], newInnerHtml);
        fs.writeFileSync(filePath, content, 'utf8');
        fixedCount++;
    }
}

console.log(`Fixed ${fixedCount} pages.`);
