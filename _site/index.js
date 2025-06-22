function edit(file) {
    let d = document.createElement('form');
    d.setAttribute("action", "https://ghe.spiewaj.com/users/me/changes:new")
    d.setAttribute("method", "post")
    let i = document.createElement("input")
    i.setAttribute("type", "hidden")
    i.setAttribute("name", "file")
    i.setAttribute("value", file)
    d.appendChild(i);

    document.body.appendChild(d);
    d.submit();
}
function filterSongs() {
    // 1. Get references to the input and the list
    const input = document.getElementById('songSearch');
    const filter = input.value.toUpperCase();
    const ul = document.getElementById('songs');
    const li = ul.getElementsByTagName('li');

    // 2. Loop through all list items
    for (let i = 0; i < li.length; i++) {
        // 3. Find the link (a) inside the list item
        const a = li[i].getElementsByTagName("a")[0];
        if (a) {
            // 4. Get the text content of the link
            const txtValue = a.textContent || a.innerText;

            // 5. Check if the song title includes the filter text
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                li[i].style.display = ""; // Show the list item
            } else {
                li[i].style.display = "none"; // Hide the list item
            }
        }
    }
}