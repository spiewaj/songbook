#/bin/bash

# Usage: find ./songs -name "*.xml" | xargs -n 1 ./src/fix.sh
find ./songs -name "*.xml" | xargs -n 1 ./src/fix.sh


# This file fixes common misspells
# Normalizations

sed -i.bak "s|,,Stare Żbiki''|„Stare Żbiki”|g" $1
sed -i.bak "s|\"Stare Żbiki\"|„Stare Żbiki”|g" $1
sed -i.bak "s|,,Stare Żbiki&#039;&#039;|„Stare Żbiki”|g" $1
sed -i.bak "s|21. WDH „Stare Żbiki”|21. WDW „Stare Żbiki”|g" $1

sed -i.bak "s|Zejman i Garkumpel|Zejman \&amp; Garkumpel|g" $1
sed -i.bak "s|Trzy dni Tyłem|Trzy Dni Tyłem|g" $1

sed -i.bak "s|Aleksander Grotowski, Małgorzata Zwierzchowska|Aleksander Grotowski; Małgorzata Zwierzchowska|g" $1
sed -i.bak "s|Zespół Reprezentacyjny Programu Trzeciego Polskiego Radia|Zespół Reprezentacyjny|g" $1
sed -i.bak "s|Przemysław Gintrowski, Jacek Kaczmarski, Zbigniew Łapinski|Przemysław Gintrowski; Jacek Kaczmarski; Zbigniew Łapinski|g" $1

rm "$1.bak"