function simplifyString(str) {
    if (typeof str !== 'string') {
        return '';
    }
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ł/gi, 'l'); // Added to handle 'ł' and 'Ł'
}

function filterSongs() {
    // 1. Get references to the input and the list
    const input = document.getElementById('songSearch');
    const filter = input.value.toUpperCase();
    const ul = document.getElementById('songs');
    const li = ul.getElementsByTagName('li');

    // 2. Loop through all list items
    for (let i = 0; i < li.length; i++) {
        let txtValue = "";
        // 3. Find the link (a) inside the list item
        const a = li[i].getElementsByTagName("a")[0];
        if (a) {
            txtValue += ' ' + a.textContent || a.innerText;
        }
        for (const span of li[i].getElementsByTagName("span")) {
            if (span.textContent != 'edit') {
              txtValue += ' ' + span.textContent || span.innerText;
            }
        }
        console.log("Checking: " + simplifyString(txtValue).toUpperCase())
        if (txtValue.toUpperCase().indexOf(filter) > -1 ||
            simplifyString(txtValue).toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = ""; // Show the list item
        } else {
            li[i].style.display = "none"; // Hide the list item
        }
    }
}