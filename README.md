# Dnd-stat_manager

Gerenciador de fichas de D&D 5e (regras de 2014) para usar durante a sessão, no celular. É um PWA: abra o `index.html` (ou a página publicada) e adicione à tela de início. Tudo fica salvo no aparelho e funciona offline.

## Carregar uma ficha

- **PDF do Aurora** (recomendado): atributos, perícias, features com usos, ataques, itens (equipados e sintonizados), cargas, magias preparadas e a descrição de cada uma (das cartas do PDF). Funciona com o PDF preenchível e com o "achatado" (sem campos).
- **Arquivo do Aurora (.dnd5e / .xml)**: classes, magias, itens e sintonização. Não traz descrições, então o app completa o que estiver no SRD.
- **PDF de outra ficha**: ficha oficial preenchível da WotC ou exportada do D&D Beyond (melhor esforço).
- **Backup do app (.json)** ou texto colado, e **ficha em branco**.

## Abas

- **Combate**: PV e PV temporários, forma ativa (o dano vai primeiro para a forma), concentração com a CD do teste, espaços de magia, pacto, usos de features, cargas de itens, dados de vida, descansos, ações separadas em ação / ação bônus / reação, e equipamento com sintonização.
- **Magias**: todas as magias da lista, as preparadas marcadas, e a descrição das preparadas.
- **Formas** (druidas e quem tem Shapechange/Polymorph etc.): criaturas por CR para Wild Shape, elementais, Shapechange, Polymorph, Animal Shapes e Conjure Animals, cada uma com o stat block completo. Criaturas fora do SRD podem ser adicionadas colando o stat block.
- **Ficha**: troca de personagem, edição de tudo, história, anotações e backup.

## Dados

`data/srd-*.js` são gerados por `python tools/build_srd.py` a partir de [5e-bits/5e-database](https://github.com/5e-bits/5e-database).
Este trabalho inclui material do System Reference Document 5.1 ("SRD 5.1") da Wizards of the Coast LLC, disponível em https://dnd.wizards.com/resources/systems-reference-document, licenciado sob a [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode).

A leitura de PDF usa [pdf.js](https://mozilla.github.io/pdf.js/) (Apache 2.0, em `vendor/pdfjs`).
