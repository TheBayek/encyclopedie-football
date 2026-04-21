// Script JavaScript pour le site football
console.log("Bienvenue sur le site du football !");

// Fonction pour afficher un message
function afficherMessage() {
    alert("Football : le sport le plus populaire au monde !");
}

// Fonction pour changer la couleur du header au clic
document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('header');
    if (header) {
        header.addEventListener('click', function() {
            header.style.backgroundColor = header.style.backgroundColor === 'rgb(27, 94, 32)' ? '#4CAF50' : '#1B5E20';
        });
    }
    
    // Animation des liens de navigation
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.transition = 'transform 0.3s';
        });
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
    
    // Compteur de visites (simple)
    let visites = localStorage.getItem('visites') || 0;
    visites++;
    localStorage.setItem('visites', visites);
    console.log(`Nombre de visites : ${visites}`);
});