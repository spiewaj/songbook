import copy
from lxml import etree

def substitute_from_dict(text, replacements):
    for old_string, new_string in replacements.items():
        text = text.replace(old_string, new_string)
    return text

def interpret(c, substitions):
    if isinstance(c, etree._Element):
        for attr in c.attrib:
            c.attrib[attr] = substitute_from_dict(c.attrib[attr], substitions)
        for child in c:
            interpret(child, substitions)
        if c.text:
            c.text = substitute_from_dict(c.text, substitions)
    return c

def replace_in_file(sourceFile, targetFile, f):
    with open(sourceFile, 'r') as file:
        filedata = file.read()
    filedata = f(filedata)
    with open(targetFile, 'w') as file:
        file.write(filedata)
