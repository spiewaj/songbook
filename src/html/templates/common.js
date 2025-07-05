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