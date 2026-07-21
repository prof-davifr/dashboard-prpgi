# Relatório de Comparação: DINOV vs Dashboard PRPGI

> Gerado em: 2026-07-07
> **Assessoria de Ciência de Dados — PRPGI/IFBA**
> Prof. Dr. Davi Franco Rêgo

## Sumário Executivo

| Métrica | Valor |
|---------|-------|
| Registros DINOV (CSV) | 147 |
| Registros Dashboard (inovacao[]) | 853 |
| Chaves normalizadas (DINOV) | 147 |
| Chaves normalizadas (Dashboard) | 440 |
| Casados (match por chave normalizada) | 112 |
| Só DINOV | 35 chaves / 35 registros |
| Só Dashboard | 328 chaves / 369 registros |

**O que são "chaves normalizadas"?**

Para comparar os registros das duas fontes, extraímos o número de registro do INPI de cada lado e o normalizamos: removemos espaços, hífens, barras e prefixos como `PI`, `BR`, `MU`, ficando apenas com os dígitos e letras. Por exemplo, `PI0802052-3` e `BR 102012007763-9` tornam-se `08020523` e `1020120077639`. Essa chave comum permite identificar se um mesmo registro aparece nas duas bases, independentemente do formato em que foi digitado.

| Categoria | Significado |
|-----------|-------------|
| **Casados** | Registro encontrado tanto no CSV da DINOV quanto no Dashboard — o número do INPI coincide após a normalização |
| **Só DINOV** | Registro que está no CSV da DINOV mas não foi encontrado no Dashboard (pode ser que o pesquisador não o tenha cadastrado no Lattes) |
| **Só Dashboard** | Registro que está no Dashboard mas não consta no CSV da DINOV (pode ser um pedido ainda não concedido, ou um registro que a DINOV ainda não incorporou à sua planilha) |

## Registros Só DINOV

Total: **35** registros presentes no CSV DINOV mas **não encontrados** no Dashboard.

> 💡 **Por que isso importa?** São concessões já formalizadas no INPI que os inventores podem não ter cadastrado em seus Currículos Lattes. A coluna `CONTATO` traz os meios de contato informados pela própria DINOV.

| INPI | Obj | Conc. | Inventores | Contato |
|------|-----|-------|------------|---------|
| PI0802052-3 | PI | - | Vanessa Mendes Santos Cavalcanti    / Frederi… | vanessa@ifba.edu.br |
| PI0805723-0 | PI | 2019 | Josemir da Cruz Alexandrino    / Handerson Jo… | jca@ifba.edu.br; handerson@ifba.edu.br; … |
| MU8903003-6/ PI 0925… | PI | 2019 | Eduardo Jorge Vidal Dultra /  Wilson Acchar | e.dultra@ifba.edu.br |
| BR 102015033175-4 | PI | 2020 | MARILENA MEIRA | marilenameira@ifba.edu.br |
| BR 102016012472-7 | PI | 2020 | WILSON OTTO GOMES BATISTA | wilson.otto@ifba.edu.br |
| 13345-6 | SO | 2018 | HENRIQUE JOSÉ CARIBÉ RIBEIRO | hcaribe@ifba.edu.br |
| BR 512013001203-1 | SO | 2014 | MARCUS VINÍCIUS TEIXEIRA NAVARRO / MARIO DE J… | navarro@ifba.edu.br |
| BR 512013001206-6 | SO | 2014 | JOSE GARCIA VIVAS MIRANDA / MARCUS VINÍCIUS T… | navarro@ifba.edu.br |
| BR 512016000963-2 | SO | 2017 | ELEN BEATRIZ CARNEIRO PINTO / HANDERSON JORGE… | handerson@ifba.edu.br; |
| BR 512017000138-3 | SO | 2017 | CÁSSIO ALMEIDA LIMA / MARCOS VILARINHO TORRES | cassiolima@ifba.edu.br; marcosvilarinho@… |
| BR 512017000769-1 | SO | 2017 | EDITE LUZIA DE ALMEIDA VASCONCELOS / HESROM F… | editeluziaela@gmail.com; biomoura@gmail.… |
| 904452123 | MARCA | 2015 | Djane Santiago | djane@ifba.edu.br |
| 908799063 | MARCA | 2018 | Marcus Vinícius Teixeira Navarro | navarro@ifba.edu.br |
| 911435182 | MARCA | 2018 | Ronaldo  Bruno Ramalho | ronaldobruno@ifba.edu.br |
| 912154225 | MARCA | 2018 | Maria das Graças Bittencourt Ferreita | maria.bittencourt@ifba.edu.br |
| 912186364 | MARCA | 2019 | Henrique José Caribé Ribeiro | hcaribe@ifba.edu.br |
| MU8802959-0 | MU | 2017 | CRISTIANE FREIRE SILVÃO | 21029516,87889370, csilvao@cefetba.br |
| MU 9002752-3 | MU | 2018 | RAIMUNDO FERREIRA DA SILVA / ÂNGELO RONCALLI … | 33625094,raimundoferreirasilva@bol.com.b… |
| BR 202019014112-9 | MU | - | Josemir Alexandrino, Handerson Leite e Viníci… | jca@ifba.edu.br; handerson@ifba.edu.br; … |
| BR 512019001607-6 | SO | 2019 | CESAR AUGUSTO SILVEIRA ALVES DA CUNHA FILHO /… | jca@ifba.edu.br; |
| BR 10 2020 015506-7 | PI | 2021 | Luanda Kívia; Leonardo Santiago; Pedro Rocha;… | luandakivia@ifba.edu.br; leonardo.santia… |
| BR 512020002068-2 | SO | 2020 | EMANUEL PEREIRA CERQUEIRA; FRANCISCO JOSÉ DA … |  |
| BR 10 2022 013320 4 | PI | 2026 | LEONARDO SILVA MENEZES | leonardo.menezes@ifba.edu.br; (75); 9880… |
| BR 512023000792-7 | SO | 2023 | JOWÂNER DE OLIVEIRA ARAÚJO; GABRIEL SIMÕES RO… | jowaneraraujo@gmail.com; gabrielsreis@gm… |
| BR512024004583-0 | SO | 2024 | ANDREIA BARBOSA SOARES / MARIA CATARINA MENDO… | hebert.santana@ifbal.edu.br |
| BR 512024004735-2 | SO | 2024 | MARIO JORGE PEREIRA / PABLO VIEIRA FLORENTINO… | renato@ifba.edu.br |
| BR 512024004810-3 | SO | 2024 | LAURO PINHO DAMASCENO / MARCUS VINICIUS TEIXE… | renato@ifba.edu.br |
| BR 51 2024 005138 4 | SO | 2024 | CARLOS OTÁVIO DAMAS MARTINS / FRANCIRLEY PAZ … | ivan.silva@ifba.edu.br |
| BR512025004520-4 | SO | 2025 | REGILAN MEIRA SILVA; CARLOS ALBERTO LIMA AMOR… |  |
| BR512025007003-9 | SO | 2025 | ALBA ROGÉRIA DOS SANTOS SILVA / CATARINA FERR… | catarina.silveira@ifba.edu.br |
| BR512025006649-0  | SO | 2025 | ALBA ROGÉRIA DOS SANTOS SILVA / CATARINA FERR… | catarina.silveira@ifba.edu.br |
| BR 51 2025 004932 | SO | - | CORETTA JANERETTE / DANIEL DE SANTANA NETO / … |  |
| BR512025007001-2 | SO | 2025 | ALBA ROGÉRIA DOS SANTOS SILVA / CATARINA FERR… | catarina.silveira@ifba.edu.br |
| 512026003509-0 | SO | 2026 | MARCIO LUIS VALENÇA ARAÚJO, EDUARDO OLIVEIRA … | MARCIOARAUJO@IFBA.EDU.BR |
| 512026003525-2 | SO | 2026 | ANTÔNIO CARLOS DOS SANTOS SOUZA, ENEIDA SANTA… | antoniocarlos@ifba.edu.br |

## Registros Só Dashboard

Total: **369** registros no Dashboard mas **não encontrados** no CSV DINOV.

**Possíveis causas (sugestões para investigação):**
1. **Registro em andamento ou não concedido** — pode ser um pedido de PI que o pesquisador registrou no Lattes mas que ainda não foi concedido, foi indeferido, ou não chegou a ser depositado formalmente junto ao INPI. Sugere-se verificar no Lattes do pesquisador o status informado.
2. **Concedido mas ainda não inserido na planilha DINOV** — talvez o título tenha sido concedido recentemente e ainda não tenha sido incluído no controle da DINOV. Uma consulta na base do INPI pode confirmar.
3. **Tipo não controlado pela DINOV** — marcas, cultivares, ou outros tipos de registro que fogem ao escopo da planilha atual.
4. **Registro estrangeiro** — patentes depositadas no exterior (USPTO, EPO, WIPO) que podem não constar na base da DINOV.

| Tipo | Campus | Ano | Pesquisador | Nº Registro |
|------|--------|-----|-------------|-------------|
| Software | BAR | 2024 | Kalyf Abdalla Buzar Lima | 5120240039597 |
| Patente | BAR | 2023 | Erick Jarles Santos de Araujo | 10202302498 |
| Software | BAR | 2023 | Lourivaldo Barreto Pereira | 5120230010898 |
| Patente | BAR | 2023 | Vilma Barbosa da Silva Araujo | 10202302551 |
| Patente | BAR | 2021 | Lourivaldo Barreto Pereira | 102202104425 |
| Software | BAR | 2020 | Lourivaldo Barreto Pereira | 5120200026630 |
| Patente | BAR | 2020 | Vilma Barbosa da Silva Araujo | 10201900305 |
| Software | BAR | 2017 | Tuane Lisboa Silva Paixao | 5120190009894 |
| Patente | BAR | 2016 | Tuane Lisboa Silva Paixao | 1020160042348 |
| Patente | BAR | 2015 | Vilma Barbosa da Silva Araujo | 10201501621 |
| Software | CAM | 2026 | Tereza Kelly Gomes Carneiro | 5120260006988 |
| Software | CAM | 2026 | Tereza Kelly Gomes Carneiro | 5120260006740 |
| Software | CAM | 2026 | Tereza Kelly Gomes Carneiro | 5120260006767 |
| Software | CAM | 2026 | Tereza Kelly Gomes Carneiro | 5120260006910 |
| Software | CAM | 2025 | Antonio Carlos dos Santos Souza | 5120250027338 |
| Software | SSA | 2025 | Isabelle Matos Pinheiro | 5120250027338 |
| Software | CAM | 2025 | Antonio Carlos dos Santos Souza | 5120250002343 |
| Software | CAM | 2025 | Tereza Kelly Gomes Carneiro | 120250060793 |
| Software | CAM | 2023 | Eneida Santana de Avila Goulart | 5120230020486 |
| Software | CAM | 2022 | Marcio Luis Valenca Araujo | 5120220019728 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220019728 |
| Software | CAM | 2022 | Vagner Simoes Santos | 5120220019248 |
| Software | CAM | 2022 | Vagner Simoes Santos | 5120220004801 |
| Patente | CAM | 2020 | Eduardo Oliveira Teles | 1020200157825 |
| Software | CAM | 2019 | Vagner Simoes Santos | 5120190027066 |
| Software | CAM | 2018 | Tereza Kelly Gomes Carneiro | 5120180009174 |
| Software | CAM | 2018 | Tereza Kelly Gomes Carneiro | 512018000905 |
| Software | CAM | 2018 | Tereza Kelly Gomes Carneiro | 5120180009140 |
| Software | CAM | 2018 | Tereza Kelly Gomes Carneiro | 5120180009123 |
| Software | CAM | 2018 | Tereza Kelly Gomes Carneiro | 5120180009158 |
| Software | CAM | 2017 | Tereza Kelly Gomes Carneiro | 5120170003114 |
| Software | CAM | 2017 | Tereza Kelly Gomes Carneiro | 5120170003106 |
| Software | CAM | 2015 | Tereza Kelly Gomes Carneiro | 5120150010336 |
| Software | CAM | 2014 | Tereza Kelly Gomes Carneiro | 12010011887 |
| Software | CAM | 2013 | Tereza Kelly Gomes Carneiro | 5120130008425 |
| Patente | EC | 2025 | Filipe Araujo de Carvalho | 1020250164256 |
| Software | EC | 2025 | Jose Leonardo dos Santos Melo | 5120250021178 |
| Patente | EC | 2024 | Filipe Araujo de Carvalho | 10202402608 |
| Software | EC | 2024 | Maxuel Carlos de Melo | 5120240036423 |
| Software | EC | 2024 | Maxuel Carlos de Melo | 5120240036644 |
| Software | EC | 2021 | Lazaro de Souza Silva | 5120230002291 |
| Software | EC | 2021 | Lazaro de Souza Silva | 5120210016572 |
| Patente | EC | 2019 | Jonatas Macedo de Souza | 102019003002 |
| Software | EC | 2016 | Jose Leonardo dos Santos Melo | 5120160013087 |
| Software | EC | 2016 | Jose Leonardo dos Santos Melo | 5120160013079 |
| Software | EUN | 2025 | Marcos Gottschalg Discher | 5120250014112 |
| Patente | EUN | 2024 | Rerison Magno Borges Pimenta | 1020240166124 |
| Patente | EUN | 2023 | Rerison Magno Borges Pimenta | 10202301916 |
| Patente | EUN | 2023 | Rerison Magno Borges Pimenta | 10202300768 |
| Software | EUN | 2021 | Danilo Alves Martins de Faria | 5120210029941 |
| Software | FS | 2024 | Marcio Luis Valenca Araujo | 5120240018484 |
| Software | JAG | 2024 | Marcio Luis Valenca Araujo | 5120240018484 |
| Software | FS | 2024 | Marcio Luis Valenca Araujo | 5120240018468 |
| Software | JAG | 2024 | Marcio Luis Valenca Araujo | 5120240018468 |
| Software | FS | 2024 | Marcio Luis Valenca Araujo | 5120240050043 |
| Software | FS | 2022 | Toni Alex Reis Borges | 5120230023906 |
| Patente | FS | 2016 | Ramon Luz Lemos Santos | andamento |
| Patente | FS | 2012 | Jose Menezes da Silva | 2020120009833 |
| Software | ILH | 2025 | Hebert Costa Vaz Santana | 5120260008395 |
| Software | ILH | 2024 | Hebert Costa Vaz Santana | 5120240041680 |
| Patente | ILH | 2021 | Gabriel Jesus Alves de Melo | 1020210043849 |
| Patente | ILH | 2021 | Gabriel Jesus Alves de Melo | 10202100395 |
| Patente | ILH | 2020 | Gabriel Jesus Alves de Melo | 1020200242121 |
| Software | ILH | 2018 | Aline Silva Ramos | 5120180003575 |
| Patente | ILH | 2017 | Daiane Farias Pereira Suffredini | 1020170013308 |
| Patente | ILH | 2016 | Everton Jose da Silva | 1020160088623 |
| Patente | ILH | 2014 | Daiane Farias Pereira Suffredini | 10201401637 |
| Patente | IRE | 2025 | Ed Fabio Silva Agapito | 10202500441 |
| Software | IRE | 2025 | Renan Felipe Brito Dantas | 120250021496 |
| Software | IRE | 2023 | Renan Felipe Brito Dantas | 5120230017574 |
| Patente | IRE | 2022 | Jose Airton de Mattos Carneiro Junior | 1020220207232 |
| Patente | IRE | 2021 | Tamires Pereira Alves | 2020210149243 |
| Patente | IRE | 2021 | Tamires Pereira Alves | 2020210083226 |
| Patente | IRE | 2019 | Jose Carlos Albuquerque da Silva | 2020190117341 |
| Patente | IRE | 2017 | Fabricio Ferreira Batista | 1020170184722 |
| Patente | IRE | 2017 | Fabricio Ferreira Batista | 1020170152847 |
| Patente | IRE | 2017 | Fabricio Ferreira Batista | 1020170152820 |
| Patente | IRE | 2014 | Jose Airton de Mattos Carneiro Junior | 2020140172934 |
| Patente | JAC | 2021 | Jonei Marques da Costa | 1020210055669 |
| Software | JAC | 2021 | Philip Ramon de Araujo Santos | 5120210001834 |
| Software | JAC | 2020 | Luis Gustavo de Jesus Araujo | 5120200021212 |
| Software | LF | 2020 | Luis Gustavo de Jesus Araujo | 5120200021212 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180004105 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180004113 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180004121 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180004148 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180004199 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180004156 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180004164 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180004172 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180004180 |
| Software | JAC | 2018 | Yuri Bastos Wanderley | 5120180007953 |
| Patente | JAC | 2014 | Juciely Carvalho Maia | 1020140169776 |
| Patente | JAC | 2014 | Juciely Carvalho Maia | 1020140169784 |
| Software | JAC | 2013 | Vanessa dos Santos Rios | 5120160015870 |
| Software | JAC | 2011 | Vitor Otavio Silva Teixeira de Souza | 129140 |
| Software | JAG | 2023 | Bartolomeu das Neves Marques | 512024002386 |
| Patente | JAG | 2009 | Luciana de Matos | 0900200 |
| Patente | JEQ | 2011 | Vitor Silva Vieira | 532246 |
| Patente | JEQ | 2009 | Nubia Moura Ribeiro | 09039570 |
| Patente | JEQ | 2008 | Nubia Moura Ribeiro | 011090000508 |
| Software | JUA | 2023 | Selma Maria Rodrigues de Andrade Alves | 5120230018465 |
| Software | JUA | 2023 | Selma Maria Rodrigues de Andrade Alves | 5120230040304 |
| Patente | JUA | 2022 | Marcos Antonio Bezerra Santos Filho | 10202202258 |
| Software | LF | 2026 | Marcio Luis Valenca Araujo | 5120260005051 |
| Software | LF | 2026 | Marcio Luis Valenca Araujo | 5120260005043 |
| Patente | LF | 2025 | Adriana Vieira dos Santos | 10202500927 |
| Software | LF | 2024 | Marcio Luis Valenca Araujo | 5120240022520 |
| Software | LF | 2023 | Julita Maria Freitas Coelho | 5120230011908 |
| Software | LF | 2022 | Handerson Jorge Dourado Leite | 5120220008556 |
| Software | LF | 2022 | Luiz Claudio Machado dos Santos | 5120230001554 |
| Software | LF | 2022 | Manoel Messias Santos de Oliveira | 5120220029693 |
| Software | SF | 2022 | Manoel Messias Santos de Oliveira | 5120220029693 |
| Software | SSA | 2022 | Manoel Messias Santos de Oliveira | 5120220029693 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220005441 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220005441 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220005441 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220005425 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220005425 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220005425 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220005433 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220005433 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220005433 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220005417 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220005417 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220005417 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220005409 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220005409 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220005409 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220005450 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220005450 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220005450 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220002507 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220002507 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220002523 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220002523 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220002523 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220002515 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220002515 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220002515 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220002493 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220002493 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220001322 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220001322 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220001314 |
| Software | SAJ | 2022 | Marcio Luis Valenca Araujo | 5120220001314 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220001306 |
| Software | SAJ | 2022 | Marcio Luis Valenca Araujo | 5120220001306 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220001292 |
| Software | SAJ | 2020 | Marcio Luis Valenca Araujo | 5120220001292 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220001284 |
| Software | SAJ | 2022 | Marcio Luis Valenca Araujo | 5120220001284 |
| Software | LF | 2022 | Marcio Luis Valenca Araujo | 5120220002485 |
| Software | VAL | 2022 | Marcio Luis Valenca Araujo | 5120220002485 |
| Software | LF | 2021 | Marcio Luis Valenca Araujo | 5120210020120 |
| Software | LF | 2020 | Isabelle Matos Pinheiro | 5120200024769 |
| Software | LF | 2020 | Marcio Luis Valenca Araujo | 5120200024769 |
| Software | SSA | 2020 | Isabelle Matos Pinheiro | 5120200024769 |
| Software | LF | 2019 | Marcio Luis Valenca Araujo | 5120190019342 |
| Software | LF | 2018 | Edson Jose Dias Machado Filho | 5120180008640 |
| Software | LF | 2018 | Marcio Luis Valenca Araujo | 5120180517013 |
| Software | LF | 2015 | Marcio Luis Valenca Araujo | 5120150015923 |
| Patente | LF | 2008 | Josemir da Cruz Alexandrino | 0805723 |
| Patente | PA | 2023 | Josilene Felix da Rocha | 1020230101950 |
| Desenho Insdustrial | PA | 2020 | Carlos de Moraes Brito | 30202000435 |
| Patente | PA | 2020 | Welber Leal de Araujo Miranda | 10202001095 |
| Patente | PA | 2017 | Danielle Bandeira de Mello Delgado | 1020170129 |
| Patente | PA | 2013 | Tharsia Cristiany de Carvalho Costa | 1020130118893 |
| Patente | PA | 2012 | Marley Fagundes Tavares | 102012021136 |
| Patente | PS | 2016 | Diego Cerqueira Montes | 1020160075254 |
| Patente | PS | 2016 | Diego Cerqueira Montes | 1020160012937 |
| Patente | PS | 2016 | Diego Cerqueira Montes | 1020160011680 |
| Patente | PS | 2016 | Rauldenis Almeida Fonseca Santos | 1020160085853 |
| Patente | PS | 2014 | Diego Cerqueira Montes | 1020140286870 |
| Patente | PS | 2014 | Diego Cerqueira Montes | 1020140239669 |
| Patente | PS | 2012 | Cleiton Marcio Pinto Braga | 1020120012014 |
| Patente | PS | 2012 | Luciano da Silva Lima | 000049 |
| Patente | PS | 2011 | Luciano da Silva Lima | 000169 |
| Software | SAJ | 2025 | Leandro Costa Souza | 5120250045280 |
| Patente | SAJ | 2024 | Isabella Sampaio Santos | 1020240112679 |
| Patente | SAJ | 2024 | Peterson Albuquerque Lobato | 10202401127 |
| Patente | VAL | 2024 | Peterson Albuquerque Lobato | 10202401127 |
| Software | SAJ | 2022 | Isabella Sampaio Santos | 51202200024 |
| Software | SAJ | 2013 | Antonio Messias Lopes Cruz | 512013009243 |
| Software | SAM | 2020 | Daniel dos Anjos Costa | 5120200017410 |
| Software | SAM | 2020 | Daniel dos Anjos Costa | 5120200012353 |
| Software | SAM | 2020 | Daniel dos Anjos Costa | 5120200012337 |
| Software | SAM | 2020 | Daniel dos Anjos Costa | 5120200012361 |
| Software | SAM | 2020 | Daniel dos Anjos Costa | 5120200000037 |
| Software | SAM | 2019 | Andre Antunes Jorge | 5120190003403 |
| Software | SEA | 2024 | Maria Alice Oliveira Costa Leal | 5120240030441 |
| Software | SEA | 2023 | Monck Charles Nunes de Albuquerque | 51202300377 |
| Software | SF | 2023 | Jader Cristiano Magalhaes de Albuquerque | 5120240026894 |
| Patente | SF | 2022 | Domingo Stalin Aguero Martinez | 5120220000792 |
| Patente | SF | 2022 | Leonardo Silva Menezes | 10202201332 |
| Patente | SSA | 2022 | Leonardo Silva Menezes | 10202201332 |
| Patente | SF | 2022 | Leonardo Silva Menezes | 10202202446 |
| Patente | SF | 2021 | Kilton Renan Alves Pereira | 1020210213221 |
| Patente | SF | 2016 | Marilena Meira | 10201600558 |
| Patente | SF | 2016 | Marilena Meira | 10201600858 |
| Patente | SF | 2015 | Marilena Meira | 10201503317 |
| Patente | SF | 2014 | Elba Gomes dos Santos Leal | 1020140297618 |
| Patente | SF | 2014 | Marilena Meira | 10201402071 |
| Patente | SF | 2014 | Marilena Meira | 1020140234462 |
| Patente | SF | 2013 | Marilena Meira | 1020130212717 |
| Patente | SF | 2013 | Marilena Meira | 1020130212784 |
| Patente | SF | 2013 | Marilena Meira | 1020130212776 |
| Patente | SF | 2012 | Marilena Meira | 1020120002612 |
| Patente | SF | 2012 | Marilena Meira | 1020120002612 |
| Patente | SF | 2012 | Marilena Meira | 11120000905 |
| Patente | SF | 2012 | Marilena Meira | 1020120335298 |
| Patente | SF | 2012 | Marilena Meira | 11120000904 |
| Patente | SF | 2012 | Marilena Meira | 11120000903 |
| Patente | SF | 2012 | Marilena Meira | 1020120320215 |
| Patente | SF | 2012 | Marilena Meira | 11120000055 |
| Patente | SF | 2011 | Marilena Meira | 221106730261 |
| Patente | SF | 2011 | Marilena Meira | 00221109056839 |
| Patente | SF | 2011 | Marilena Meira | 011110000662 |
| Patente | SF | 2011 | Marilena Meira | 11044020 |
| Patente | SF | 2010 | Marilena Meira | 10201401010 |
| Patente | SF | 2010 | Marilena Meira | 10056386 |
| Patente | SF | 2010 | Marilena Meira | 10017542 |
| Patente | SSA | 2026 | Antonio Gabriel Souza Almeida | 102026000776 |
| Patente | SSA | 2025 | Lucas Barbosa da Silva | 1020250097184 |
| Software | SSA | 2025 | Marcus Vinicius Teixeira Navarro | 51202517570 |
| Software | SSA | 2024 | Andrea de Almeida Brito | 5120240013822 |
| Software | SSA | 2024 | Andrea de Almeida Brito | 5120240052038 |
| Patente | SSA | 2024 | Francislei Santa Anna Santos | 1020240100 |
| Patente | SSA | 2024 | Jose Alejandro Moreno Alfonzo | 2020240045322 |
| Software | SSA | 2024 | Marcus Vinicius Linhares de Oliveira | 5120240009221 |
| Software | SSA | 2023 | Andrea de Almeida Brito | 5120230013765 |
| Patente | SSA | 2023 | Guillermo Alberto Lopez | 1020230009387 |
| Patente | SSA | 2023 | Jose Alejandro Moreno Alfonzo | 2020230167468 |
| Patente | SSA | 2023 | Marcus Vinicius Teixeira Navarro | 10202300872 |
| Software | SSA | 2022 | Andrea de Almeida Brito | 5120220026538 |
| Software | SSA | 2022 | Andrea de Almeida Brito | 5120220026546 |
| Software | SSA | 2022 | Antonio Carlos dos Santos Souza | 5120220008 |
| Patente | SSA | 2022 | Antonio Gabriel Souza Almeida | 1020220244669 |
| Patente | SSA | 2022 | Edelvio de Barros Gomes | 10202201552 |
| Patente | SSA | 2022 | Edelvio de Barros Gomes | 10202201438 |
| Patente | SSA | 2022 | Luana Bastos Santos | 10202202107 |
| Patente | SSA | 2022 | Marcus Vinicius Teixeira Navarro | 1020220133255 |
| Patente | SSA | 2021 | Antonio Gabriel Souza Almeida | 202021008322 |
| Patente | SSA | 2021 | ID <VinculoQueryset [<Vinculo: Ebenezer Silva Cavalcanti (268728) (Servidor)>]> (não mapeado) | 2020210243770 |
| Patente | SSA | 2021 | Michell Thompson Ferreira Santiago | 1020210241306 |
| Patente | SSA | 2020 | Ana Paula dos Anjos Cordeiro | 1020200109545 |
| Software | SSA | 2020 | Andrea de Almeida Brito | 5120200011500 |
| Software | SSA | 2020 | Andrea de Almeida Brito | 5120200011497 |
| Software | SSA | 2020 | Andrea de Almeida Brito | 5120200010857 |
| Software | SSA | 2020 | Florencio Mendes Oliveira Filho | 5120200010857 |
| Software | SSA | 2020 | Andrea de Almeida Brito | 5120200010830 |
| Software | SSA | 2020 | Florencio Mendes Oliveira Filho | 5120200010830 |
| Patente | SSA | 2020 | Antonio Carlos dos Santos Souza | 1020200139568 |
| Patente | SSA | 2020 | Edgard Bacic de Carvalho | 10202002549 |
| Patente | SSA | 2020 | Edgard Bacic de Carvalho | 10202002057 |
| Software | SSA | 2020 | Florencio Mendes Oliveira Filho | 5120200023290 |
| Software | SSA | 2020 | Florencio Mendes Oliveira Filho | 5120200020003 |
| Software | SSA | 2020 | Florencio Mendes Oliveira Filho | 5120200018645 |
| Software | SSA | 2020 | Florencio Mendes Oliveira Filho | 512020001287 |
| Software | SSA | 2020 | Florencio Mendes Oliveira Filho | 512020001154 |
| Software | SSA | 2020 | Florencio Mendes Oliveira Filho | 5120200011551 |
| Software | SSA | 2020 | Florencio Mendes Oliveira Filho | 510200011497 |
| Patente | SSA | 2020 | Isabelle Matos Pinheiro | 10202001395 |
| Software | SSA | 2020 | Jose Alejandro Moreno Alfonzo | 5120220026600 |
| Software | SSA | 2020 | Juliana Ribeiro Manhaes da Silva | 5120220010208 |
| Patente | SSA | 2020 | Luanda Kivia de Oliveira Rodrigues | 10202001550 |
| Patente | SSA | 2020 | Lucas Barbosa da Silva | 10202000125 |
| Software | SSA | 2020 | Regina Maria Cunha Leite | 5120200026230 |
| Patente | SSA | 2020 | Vitor Leao Filardi | 1020200012 |
| Software | SSA | 2020 | ID <VinculoQueryset [<Vinculo: Wilson Otto Gomes Batista (282497) (Servidor)>]> (não mapeado) | 51202000229 |
| Software | SSA | 2019 | Antonio Carlos dos Santos Souza | 5120190008332 |
| Software | SSA | 2019 | Antonio Carlos dos Santos Souza | 5120190002970 |
| Patente | SSA | 2019 | Elane Santos Souza | 2020190132 |
| Patente | SSA | 2019 | Jose Mario Araujo | 202019013245 |
| Patente | SSA | 2019 | Mayara Cristina Fernandes de Carvalho | 1020190060778 |
| Software | SSA | 2019 | Tiago de Oliveira Silva | 5120190017340 |
| Software | SSA | 2019 | Tiago de Oliveira Silva | 5120190017358 |
| Software | SSA | 2019 | Tiago de Oliveira Silva | 5120190017366 |
| Software | SSA | 2019 | ID <VinculoQueryset [<Vinculo: Wilson Otto Gomes Batista (282497) (Servidor)>]> (não mapeado) | 51201900233 |
| Software | SSA | 2018 | Antonio Carlos dos Santos Souza | 5120180010431 |
| Patente | SSA | 2018 | Jose Alejandro Moreno Alfonzo | 1020180161300 |
| Patente | SSA | 2018 | Luanda Kivia de Oliveira Rodrigues | 20201807265 |
| Software | SSA | 2017 | Andrea de Almeida Brito | 5120170007446 |
| Patente | SSA | 2017 | Simone Pereira de Lima | 1020170018750 |
| Patente | SSA | 2017 | ID <VinculoQueryset [<Vinculo: Wagna Piler Carvalho dos Santos (393182) (Servidor)>]> (não mapeado) | 112017010393 |
| Patente | SSA | 2017 | ID <VinculoQueryset [<Vinculo: Wagna Piler Carvalho dos Santos (393182) (Servidor)>]> (não mapeado) | 10201701039 |
| Patente | SSA | 2016 | Francislei Santa Anna Santos | 1020160124751 |
| Patente | SSA | 2016 | ID <VinculoQueryset [<Vinculo: Raimundo Jorge Abreu de Jesus (268587) (Servidor)>]> (não mapeado) | 1020160186463 |
| Patente | SSA | 2016 | Vitor Leao Filardi | 1020160153484 |
| Patente | SSA | 2016 | ID <VinculoQueryset [<Vinculo: Wilson Otto Gomes Batista (282497) (Servidor)>]> (não mapeado) | 10201601247 |
| Software | SSA | 2015 | Andrea de Almeida Brito | 20160003758 |
| Patente | SSA | 2015 | Edelvio de Barros Gomes | 10201502392 |
| Patente | SSA | 2015 | Francislei Santa Anna Santos | 1020150324480 |
| Patente | SSA | 2015 | Luciene Santos Carvalho | 1020150326041 |
| Patente | SSA | 2015 | Luciene Santos Carvalho | 1020150326050 |
| Patente | SSA | 2015 | Walter Alves Gomes Junior | 1020150239262 |
| Patente | SSA | 2014 | ID <VinculoQueryset [<Vinculo: Claudio Mario Nascimento (268736) (Servidor)>]> (não mapeado) | 102015012082 |
| Patente | SSA | 2014 | Denise Santos de Sa | 1020140272909 |
| Patente | SSA | 2014 | ID <VinculoQueryset [<Vinculo: Ebenezer Silva Cavalcanti (268728) (Servidor)>]> (não mapeado) | 1020140307400 |
| Software | SSA | 2014 | Lauro Cassio Martins de Paula | 5120130014816 |
| Software | SSA | 2014 | Lauro Cassio Martins de Paula | 5120130014573 |
| Patente | SSA | 2014 | Luanda Kivia de Oliveira Rodrigues | 1020140289623 |
| Patente | SSA | 2014 | Stefani Silva Pires | 1478231991855 |
| Software | SSA | 2014 | Marcus Vinicius Teixeira Navarro | 51201300120 |
| Software | SSA | 2014 | Marcus Vinicius Teixeira Navarro | 51201300120 |
| Software | SSA | 2013 | Marcus Vinicius Teixeira Navarro | 51201300120 |
| Software | SSA | 2013 | Marcus Vinicius Teixeira Navarro | 51201300120 |
| Patente | SSA | 2013 | Henrique Jose Caribe Ribeiro | 1020130144886 |
| Software | SSA | 2013 | Marcus Fernandes da Silva | 5120140003396 |
| Patente | SSA | 2011 | Eduardo Telmo Fonseca Santos | us20130169827a1 |
| Patente | SSA | 2011 | Eduardo Telmo Fonseca Santos | us20130170765a1 |
| Patente | SSA | 2011 | Eduardo Telmo Fonseca Santos | 221101163849 |
| Patente | SSA | 2011 | Rodrigo Estevam Coelho | 0000221104434231 |
| Patente | SSA | 2011 | Rodrigo Estevam Coelho | 0000221104434126 |
| Patente | SSA | 2011 | Vitor Leao Filardi | 221109055280 |
| Patente | SSA | 2011 | ID <VinculoQueryset [<Vinculo: Wilson Otto Gomes Batista (282497) (Servidor)>]> (não mapeado) | 1101586 |
| Software | SSA | 2010 | Allan Edgard Silva Freitas | 5120130010489 |
| Patente | SSA | 2010 | Edelvio de Barros Gomes | 10009973 |
| Patente | SSA | 2010 | Eduardo Telmo Fonseca Santos | us20120173347a1 |
| Patente | SSA | 2010 | Eduardo Telmo Fonseca Santos | us20120170801a |
| Patente | SSA | 2010 | Eduardo Telmo Fonseca Santos | us20110155808a1 |
| Patente | SSA | 2009 | Eduardo Telmo Fonseca Santos | 0906032 |
| Patente | SSA | 2009 | Genisson Silva Coutinho | 0904831 |
| Patente | SSA | 2008 | Cristiane Freire Silvao | 8802959 |
| Patente | SSA | 2008 | Vanessa Mendes Santos | 0802052 |
| Software | SSA | 2006 | Antonio Carlos dos Santos Souza | 072066 |
| Software | SSA | 2004 | Paschoal Molinari Neto | 061922 |
| Patente | SSA | 2002 | Vanessa Mendes Santos | 0200007 |
| Software | VAL | 2025 | Peterson Albuquerque Lobato | 5120250025130 |
| Patente | VAL | 2024 | Peterson Albuquerque Lobato | 10202401126 |
| Patente | VAL | 2022 | Peterson Albuquerque Lobato | 10202201732 |
| Software | VAL | 2021 | Peterson Albuquerque Lobato | 5120210032136 |
| Software | VAL | 2019 | Peterson Albuquerque Lobato | 5120190015150 |
| Software | VAL | 2019 | Peterson Albuquerque Lobato | 5120190015177 |
| Software | VAL | 2019 | Peterson Albuquerque Lobato | 5120190015126 |
| Software | VAL | 2019 | Peterson Albuquerque Lobato | 5120190015169 |
| Software | VAL | 2019 | Peterson Albuquerque Lobato | 5120190009878 |
| Patente | VAL | 2019 | Peterson Albuquerque Lobato | 1020190093838 |
| Software | VAL | 2017 | Ivana Carolina Alves da Silva Souza | 5120180012051 |
| Patente | VAL | 2011 | Raigenis da Paz Fiuza | 011110000865 |
| Patente | VAL | 2011 | Raigenis da Paz Fiuza | 10027482 |
| Software | VAL | 2011 | Vanessa dos Santos Rios | 115761 |
| Patente | VAL | 2010 | Raigenis da Paz Fiuza | 10027483 |
| Patente | VAL | 2010 | Raigenis da Paz Fiuza | 001080000830 |
| Software | VAL | 2009 | Peterson Albuquerque Lobato | 698818022 |
| Patente | VAL | 2009 | Raigenis da Paz Fiuza | 011090000769 |
| Desenho Insdustrial | VC | 2023 | Tarcisio Mereles Angelo Araujo | 3020230024174 |
| Desenho Insdustrial | VC | 2023 | Tarcisio Mereles Angelo Araujo | 3020230024190 |
| Software | VC | 2023 | Tarcisio Mereles Angelo Araujo | 5120230029262 |
| Patente | VC | 2022 | Antonio de Araujo Pereira | 000 |
| Software | VC | 2021 | Alexandro dos Santos Silva | 5120210021142 |
| Patente | VC | 2015 | Marcelo Mendonca dos Santos | 1020150103832 |
| Patente | VC | 2015 | Marcelo Mendonca dos Santos | 1020150103662 |
| Patente | VC | 2014 | Bruna Figueredo Lopes Mosckem | 1020140173978 |
| Patente | VC | 2013 | Alberto dos Santos Reboucas | 1020130289299 |
| Patente | VC | 2012 | Jaime dos Santos Filho | 1020120014238 |
| Patente | VC | 2010 | ANDREA LOPES DE OLIVEIRA FERREIRA | 7648831b2 |
| Patente | VC | 2008 | ANDREA LOPES DE OLIVEIRA FERREIRA | 040508221wo |
| Patente | VC | 2008 | Alberto dos Santos Reboucas | 08057974 |
| Patente | VC | 2006 | ANDREA LOPES DE OLIVEIRA FERREIRA | 20060127971 |
| Patente | VC | 2005 | ANDREA LOPES DE OLIVEIRA FERREIRA | us2006127971a1 |
| Patente | VC | 2005 | ANDREA LOPES DE OLIVEIRA FERREIRA | in200502272p1 |
| Patente | VC | 2003 | ANDREA LOPES DE OLIVEIRA FERREIRA | cn1732256a |
| Patente | VC | 2003 | ANDREA LOPES DE OLIVEIRA FERREIRA | au2003283088a8 |
| Patente | VC | 2003 | ANDREA LOPES DE OLIVEIRA FERREIRA | wo2004050822a1 |
| Patente | VC | 2003 | ANDREA LOPES DE OLIVEIRA FERREIRA | ep1565546a1 |
| Patente | VC | 2003 | ANDREA LOPES DE OLIVEIRA FERREIRA | au2003283088a1 |
| Patente | VC | 2002 | ANDREA LOPES DE OLIVEIRA FERREIRA | 200205242a |
| Patente | VC | 2001 | Elvio Prado da Silva | 81036019 |

## Distribuição Temporal

| Ano | DINOV | Dashboard |
|-----|------|-----------|
| 2001 | 0 | 1 |
| 2002 | 0 | 2 |
| 2003 | 0 | 5 |
| 2004 | 0 | 1 |
| 2005 | 0 | 2 |
| 2006 | 0 | 2 |
| 2008 | 3 | 9 |
| 2009 | 1 | 7 |
| 2010 | 1 | 11 |
| 2011 | 4 | 25 |
| 2012 | 4 | 27 |
| 2013 | 4 | 19 |
| 2014 | 4 | 31 |
| 2015 | 7 | 23 |
| 2016 | 5 | 24 |
| 2017 | 4 | 22 |
| 2018 | 6 | 25 |
| 2019 | 9 | 47 |
| 2020 | 9 | 101 |
| 2021 | 7 | 54 |
| 2022 | 12 | 226 |
| 2023 | 13 | 59 |
| 2024 | 19 | 72 |
| 2025 | 33 | 51 |
| 2026 | 2 | 7 |

## Distribuição por Campus

| Campus | DINOV | Dashboard |
|--------|-------|-----------|
| SSA | 86 | 282 |
| LF | 11 | 133 |
| VAL | 13 | 84 |
| SAJ | 0 | 51 |
| SF | 3 | 46 |
| CAM | 5 | 44 |
| JAC | 0 | 40 |
| FS | 4 | 30 |
| VC | 3 | 25 |
| IRE | 1 | 17 |
| EUN | 2 | 15 |
| ILH | 4 | 13 |
| EC | 0 | 14 |
| SAM | 5 | 8 |
| JAG | 0 | 12 |
| PA | 4 | 6 |
| BAR | 0 | 10 |
| PS | 0 | 9 |
| SEA | 2 | 4 |
| JEQ | 0 | 6 |
| JUA | 0 | 4 |
| desconhecido | 2 | 0 |
| PIS | 1 | 0 |
| Lauro de Freitas, Camaçari e Feira de Santana | 1 | 0 |

## Registros Casados — Consistência

Total de chaves casadas: **112**. Abaixo, comparamos tipo, ano e campus dos registros que aparecem em ambas as fontes.

### Tipo (Dashboard vs OBJETO)

| Resultado | Quantidade | % |
|-----------|-----------|-----|
| Consistente | 296 | 100.0% |
| Divergente | 0 | 0.0% |

### Ano (Dashboard vs ANO DEPÓSITO)

| Resultado | Quantidade | % |
|-----------|-----------|-----|
| Consistente | 208 | 70.3% |
| Divergente | 88 | 29.7% |

**Divergências de Ano:**

| Nº INPI (DINOV) | ANO DEPÓSITO (DINOV) | Ano (Dashboard) |
|-----------------|----------------------|-----------------|
| BR 102015026201-9  | 2015 | 2017 |
| BR 102015026201-9  | 2015 | 2017 |
| 11781-2 | 2011 | 2014 |
| BR 512014001255-7 | 2014 | 2012 |
| BR 512015001183-9 | 2015 | 2013 |
| BR 512015001183-9 | 2015 | 2013 |
| BR 512015001183-9 | 2015 | 2013 |
| BR 512015001183-9 | 2015 | 2013 |
| BR 512018000204-8 | 2018 | 2015 |
| BR 512018000249-8 | 2018 | 2017 |
| BR512018001050-4 | 2018 | 2017 |
| BR512018001050-4 | 2018 | 2017 |
| BR512018001050-4 | 2018 | 2017 |
| BR512018001050-4 | 2018 | 2017 |
| BR 512020000282-0 | 2020 | 2019 |
| BR 51 2021 001107-4 | 2021 | 2020 |
| BR 51 2021 001107-4 | 2021 | 2020 |
| BR 51 2021 001214-3 | 2021 | 2020 |
| BR 51 2022 000 851-3 | 2022 | 2020 |
| BR 51 2022 000 911-0 | 2022 | 2021 |
| BR 51 2022 000 911-0 | 2022 | 2021 |
| BR 51 2022 000 911-0 | 2022 | 2021 |
| BR 51 2022 000 911-0 | 2022 | 2021 |
| BR302023000382-7 | 2024 | 2023 |
| BR 512023000225-9 | 2023 | 2022 |
| BR 512023000225-9 | 2023 | 2022 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR 512023000227-5 | 2023 | 2021 |
| BR512023001134-7 | 2023 | 2022 |
| BR 51 2023 003603-0 | 2023 | 2022 |
| BR512023004008-8 | 2023 | 2022 |
| BR512023004008-8 | 2023 | 2022 |
| BR512023004008-8 | 2023 | 2022 |
| BR512023004008-8 | 2023 | 2022 |
| BR512023004008-8 | 2023 | 2022 |
| BR512023004008-8 | 2023 | 2022 |
| BR512023004008-8 | 2023 | 2022 |
| BR512023004008-8 | 2023 | 2022 |
| BR512023004008-8 | 2023 | 2022 |
| BR 51 2024 000226-0 | 2024 | 2023 |
| ... e mais 38 divergências |

### Campus (Dashboard vs CAMPUS)

| Resultado | Quantidade | % |
|-----------|-----------|-----|
| Consistente | 197 | 68.4% |
| Divergente | 91 | 31.6% |

**Divergências de Campus:**

| Nº INPI (DINOV) | CAMPUS (DINOV) | Campus (Dashboard) |
|-----------------|----------------|--------------------|
| MU8903003-6/ PI 0925423-4 | Salvador → code SSA | EUN |
| BR 512015000928-1 | Salvador → code SSA | FS |
| BR 512015000928-1 | Salvador → code SSA | FS |
| BR 512015000928-1 | Salvador → code SSA | FS |
| BR 512016001116-5 | Salvador → code SSA | CAM |
| BR 512016001116-5 | Salvador → code SSA | CAM |
| BR 512016001116-5 | Salvador → code SSA | CAM |
| BR 512016001116-5 | Salvador → code SSA | CAM |
| BR 512018000204-8 | Santo Amaro → code SAM | LF |
| BR 512018000249-8 | Santo Amaro → code SAM | LF |
| BR512018001050-4 | Santo Amaro → code SAM | LF |
| BR512018001050-4 | Santo Amaro → code SAM | LF |
| BR512018001050-4 | Santo Amaro → code SAM | LF |
| BR512018001050-4 | Santo Amaro → code SAM | LF |
| BR 512019000843-0 | Santo Amaro → code SAM | SSA |
| BR 302015004729-1  | Paulo Afonso → code PA | SF |
| BR 512019002157-6 | Salvador → code SSA | LF |
| BR 512019002157-6 | Salvador → code SSA | LF |
| BR 512019002157-6 | Salvador → code SSA | SF |
| BR 512019002157-6 | Salvador → code SSA | SF |
| BR 512020001910-2 | Salvador → code SSA | LF |
| BR 51 2020 002795-4 | Salvador → code SSA | LF |
| BR 51 2022 000 272-8 | Salvador → code SSA | JAC |
| BR 51 2022 000 272-8 | Salvador → code SSA | JAC |
| BR 51 2022 000 272-8 | Salvador → code SSA | JAC |
| BR 51 2022 000 272-8 | Salvador → code SSA | JAC |
| BR 51 2022 000 273-6 | Salvador → code SSA | JAC |
| BR 51 2022 000 273-6 | Salvador → code SSA | JAC |
| BR 51 2022 000 273-6 | Salvador → code SSA | JAC |
| BR 51 2022 000 273-6 | Salvador → code SSA | JAC |
| BR 51 2022 000 275-2 | Salvador → code SSA | JAC |
| BR 51 2022 000 275-2 | Salvador → code SSA | JAC |
| BR 51 2022 000 275-2 | Salvador → code SSA | JAC |
| BR 51 2022 000 275-2 | Salvador → code SSA | JAC |
| BR 51 2022 000 277-9 | Salvador → code SSA | JAC |
| BR 51 2022 000 277-9 | Salvador → code SSA | JAC |
| BR 51 2022 000 277-9 | Salvador → code SSA | JAC |
| BR 51 2022 000 277-9 | Salvador → code SSA | JAC |
| BR 51 2022 000 851-3 | Salvador → code SSA | LF |
| BR 51 2022 000 911-0 | Salvador → code SSA | JAG |
| BR 51 2022 000 911-0 | Salvador → code SSA | JAG |
| BR 51 2022 000 911-0 | Salvador → code SSA | JAG |
| BR 51 2022 000 911-0 | Salvador → code SSA | JAG |
| BR 51 2022 000 911-0 | Salvador → code SSA | LF |
| BR 51 2022 000 911-0 | Salvador → code SSA | LF |
| BR 51 2022 000 911-0 | Salvador → code SSA | LF |
| BR 51 2022 000 911-0 | Salvador → code SSA | LF |
| BR 30 2023 000382-7 | Paulo Afonso → code PA | SF |
| BR302023000382-7 | Paulo Afonso → code PA | SF |
| BR 512023000227-5 | Lauro de Freitas → code LF | FS |
| ... e mais 41 divergências |

## Observações e Sugestões

- **Campo CAMPUS do CSV**: em algumas linhas, este campo contém nomes de inventores ou informações adicionais junto com o campus. A validação tenta mapear o nome da cidade para o código do campus, mas pode não reconhecer valores muito divergentes. Uma sugestão é uniformizar este campo na planilha DINOV para facilitar futuras análises.
- **1 registros** da DINOV com campus não identificado automaticamente (o campo `CAMPUS` não corresponde exatamente a nenhuma cidade IFBA conhecida). Revisão manual pode ser necessária.

### Registros apenas na DINOV — sugestões

Os **35 registros** que estão no CSV da DINOV mas não aparecem no Dashboard são concessões já formalizadas no INPI cujos inventores talvez ainda não tenham incluído o registro em seus Currículos Lattes.
A tabela da seção **Registros Só DINOV** inclui os contatos extraídos do próprio CSV da DINOV. Uma sugestão é que o setor responsável utilize esses contatos para dialogar com os inventores e, se for o caso, solicitar a atualização dos Lattes com o número do registro concedido.

### Registros apenas no Dashboard — sugestões

Os **369 registros** que estão no Dashboard mas não constam no CSV da DINOV podem ter diferentes explicações. Seguem algumas possibilidades:
1. **Pedido ainda não concedido**: o pesquisador pode ter cadastrado no Lattes um pedido de PI que está em andamento, foi indeferido ou não chegou a ser depositado. Sugere-se verificar o status no Lattes ou na base do INPI.
2. **Concedido mas ainda não registrado na planilha DINOV**: pode ser um título concedido recentemente ou que ainda não foi incorporado ao controle da DINOV. Uma consulta pontual na base do INPI ajudaria a confirmar.
3. **Tipo fora do escopo da planilha**: marcas, cultivares e registros estrangeiros podem não ser cobertos pela planilha atual da DINOV.
4. **Registro estrangeiro**: patentes depositadas em outros escritórios (USPTO, EPO, WIPO) podem não estar na base da DINOV.

> 💡 **Nota:** 10 registros exibem apenas o ID numérico do servidor, pois o nome não foi encontrado no mapa de servidores. O ID pode ser cruzado com a base do SUAP/DP-PRPGI para obter nome completo e e-mail.

---

*Relatório gerado pela **Assessoria de Ciência de Dados — PRPGI/IFBA**.*

*Prof. Dr. Davi Franco Rêgo*
