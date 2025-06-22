<?xml version="1.0" encoding="UTF-8"?>

<xsl:stylesheet version="1.0"
                xmlns="http://21wdh.staszic.waw.pl"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://21wdh.staszic.waw.pl https://spiewaj.com/song.xsd">
  <xsl:output method="xml" indent="yes" omit-xml-declaration="no" standalone="yes"/>

  <xsl:template match="@*|node()">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="xhtml:song-editor">
    <song>
      <xsl:attribute name="xsi:schemaLocation">http://21wdh.staszic.waw.pl https://spiewaj.com/song.xsd</xsl:attribute>
      <xsl:attribute name="title">
        <xsl:value-of select="@title"/>
      </xsl:attribute>
      <xsl:apply-templates select="@alias"/>
      <xsl:apply-templates select="@text_author"/>
      <xsl:apply-templates select="@comment"/>
      <xsl:apply-templates select="@composer"/>
      <xsl:apply-templates select="@artist"/>
      <xsl:apply-templates select="@translator"/>
      <xsl:apply-templates select="@original_title"/>
      <xsl:apply-templates select="xhtml:song-body"/>

      <xsl:if test="(@metre != '') or (@guitar_barre != '')">
        <music>
          <xsl:if test="@metre != ''">
            <xsl:attribute name="metre">
              <xsl:value-of select="@metre"/>
            </xsl:attribute>
          </xsl:if>
          <xsl:if test="@guitar_barre != ''">
            <guitar>
              <xsl:attribute name="barre">
                <xsl:value-of select="@guitar_barre"/>
              </xsl:attribute>
            </guitar>
          </xsl:if>
        </music>
      </xsl:if>

      <keywords>
        <xsl:call-template name="splitIntoElements">
          <xsl:with-param name="datalist" select="@keywords"/>
          <xsl:with-param name="element" select="'keyword'"/>
        </xsl:call-template>
      </keywords>
      <xsl:apply-templates select="@album"/>
      <xsl:apply-templates select="@genre"/>
      <status>
        <done>
          <xsl:if test="@done_text">
            <text/>
          </xsl:if>
          <xsl:if test="@done_authors">
            <authors/>
          </xsl:if>
          <xsl:if test="@done_chords">
            <chords>
              <xsl:value-of select="@done_chords"/>
            </chords>
          </xsl:if>
        </done>
        <verificators>
          <xsl:call-template name="splitIntoElements">
            <xsl:with-param name="datalist" select="@verificators"/>
            <xsl:with-param name="element" select="'verificator'"/>
          </xsl:call-template>
        </verificators>
        <xsl:apply-templates select="@to_do"/>
      </status>
      <xsl:apply-templates select="@music_source"/>
    </song>
  </xsl:template>

  <xsl:template name="splitIntoElements">
    <xsl:param name="datalist"/>
    <xsl:param name="element" select="'item'"/>
    <xsl:param name="delim" select="'&#10;'"/>
    <xsl:choose>
      <xsl:when test="contains($datalist,$delim)">
        <xsl:if test="substring-before($datalist,$delim)">
          <xsl:if test="normalize-space(substring-before($datalist,$delim)) != ''">
            <xsl:element name="{$element}">
              <xsl:value-of select="normalize-space(substring-before($datalist,$delim))"/>
            </xsl:element>
          </xsl:if>
        </xsl:if>
        <xsl:call-template name="splitIntoElements">
          <xsl:with-param name="datalist" select="substring-after($datalist,$delim)"/>
          <xsl:with-param name="element" select="$element"/>
          <xsl:with-param name="delim" select="$delim"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="string-length($datalist)>0">
        <xsl:if test="$datalist and normalize-space($datalist)!=''">
          <xsl:element name="{$element}">
            <xsl:value-of select="$datalist"/>
          </xsl:element>
        </xsl:if>
      </xsl:when>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="@text_author">
    <xsl:call-template name="creator">
      <xsl:with-param name="type" select="../@text_author_type"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="@composer">
    <xsl:call-template name="creator">
      <xsl:with-param name="type" select="../@composer_type"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="@artist">
    <xsl:call-template name="creator">
      <xsl:with-param name="type" select="../@artist_type"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="@alias">
    <xsl:call-template name="attr2field"/>
  </xsl:template>
  <xsl:template match="@original_title">
    <xsl:call-template name="attr2field"/>
  </xsl:template>
  <xsl:template match="@translator">
    <xsl:call-template name="attr2field"/>
  </xsl:template>
  <xsl:template match="@album">
    <xsl:call-template name="attr2field"/>
  </xsl:template>
  <xsl:template match="@music_source">
    <xsl:call-template name="attr2field"/>
  </xsl:template>
  <xsl:template match="@genre">
    <xsl:call-template name="attr2field"/>
  </xsl:template>
  <xsl:template match="@comment">
    <xsl:call-template name="attr2field"/>
  </xsl:template>
  <xsl:template match="@to_do">
    <xsl:call-template name="attr2field"/>
  </xsl:template>

  <xsl:template name="attr2field">
    <xsl:if test=". != ''">
      <xsl:element name="{name()}">
        <xsl:value-of select="."/>
      </xsl:element>
    </xsl:if>
  </xsl:template>


  <xsl:template name="creator">
    <xsl:param name="type" select="''"/>
    <xsl:if test=". != ''">
      <xsl:element name="{name()}">
        <xsl:if test="$type != ''">
          <xsl:attribute name="type">
            <xsl:value-of select="$type"/>
          </xsl:attribute>
        </xsl:if>
        <xsl:value-of select="."/>
      </xsl:element>
    </xsl:if>
  </xsl:template>

  <xsl:template match="xhtml:song-body">
    <lyric>
      <xsl:apply-templates select="xhtml:song-verse"/>
    </lyric>
  </xsl:template>

  <xsl:template match="xhtml:song-verse">
    <xsl:if test="not(@blocknb)">
      <block>
        <xsl:apply-templates select="xhtml:song-rows|@type"/>
      </block>
    </xsl:if>
    <xsl:if test="@blocknb">
      <blocklink>
        <xsl:variable name="bn" select="@blocknb"/>
        <xsl:attribute name="blocknb">
          <xsl:value-of
                  select='count(//xhtml:song-verse[@id=$bn]/preceding-sibling::xhtml:song-verse[not(@blocknb)])+1'/>
        </xsl:attribute>
      </blocklink>
    </xsl:if>
  </xsl:template>


  <xsl:template match="xhtml:song-bis">
    <bis>
      <xsl:attribute name="times">
        <xsl:value-of select="@x"/>
      </xsl:attribute>
      <xsl:apply-templates select="xhtml:song-rows"/>
    </bis>
  </xsl:template>

  <xsl:template match="xhtml:song-rows">
    <xsl:apply-templates select="xhtml:song-row|xhtml:song-bis"/>
  </xsl:template>

  <xsl:template match="xhtml:song-row/node()[1][name()=''][ starts-with(.,' ') or starts-with(.,'&#160;')]">
    <xsl:value-of select="substring(., 2)"/>
  </xsl:template>

  <xsl:template match="xhtml:song-row">
    <row>
        <xsl:attribute name="important_over">
          <xsl:if test="@important_over"><xsl:value-of select="@important_over"/></xsl:if>
          <xsl:if test="not(@important_over)">false</xsl:if>
        </xsl:attribute>
      <xsl:if test="@type">
        <xsl:attribute name='style'>
          <xsl:value-of select="@type"/>
        </xsl:attribute>
      </xsl:if>
        <xsl:if test="boolean(@sidechords) and not(@type='instr')">
          <xsl:attribute name="sidechords">
            <xsl:value-of select="normalize-space(@sidechords)"/>
          </xsl:attribute>
        </xsl:if>
        <xsl:if test="@type='instr'"><xsl:text> </xsl:text><xsl:apply-templates select="./xhtml:song-ch"/></xsl:if>
        <xsl:if test="not(@type='instr')">
          <xsl:apply-templates select="node()"/>
        </xsl:if>
    </row>
  </xsl:template>

  <xsl:template match="xhtml:song-ch">
    <xsl:if test="string-length(@a) > 0">
      <ch>
        <xsl:attribute name="a">
          <xsl:value-of select="@a"/>
        </xsl:attribute>
      </ch>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>