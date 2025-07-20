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
            // 4. Get the text content of the link
            txtValue += ' ' + a.textContent || a.innerText;
        }
        for (const span of li[i].getElementsByTagName("span")) {
            // 4. Get the text content of the span
            txtValue += ' ' + span.textContent || span.innerText;
        }
        // 5. Check if the song title includes the filter text
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = ""; // Show the list item
        } else {
            li[i].style.display = "none"; // Hide the list item
        }
    }
}