from lxml import etree
import sys

def validateSongs(files):
    xmlschema_doc = etree.parse("./_site/song.xsd")
    xmlschema = etree.XMLSchema(xmlschema_doc)

    for file in files:
        try:
            xml_doc = etree.parse(file)
            xmlschema.assertValid(xml_doc)
        except etree.DocumentInvalid as e:
            print(file,": ", e)
        except etree.XMLSyntaxError as e:
            print(file,": ", e)

def main():
    if len(sys.argv)>1:
        validateSongs(sys.argv[1:])
    else:
        print("list of files required");

main()