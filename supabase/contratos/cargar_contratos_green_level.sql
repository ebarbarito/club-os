-- Carga los 3 documentos de Green Level para la firma digital de la
-- segunda parte del alta. Generado desde supabase/contratos/*.txt.
-- Los textos después se pueden editar en Configuración → Documentos para firmar.
update tenants
set documentos_adhesion = jsonb_build_array(
  jsonb_build_object(
    'titulo', 'Formulario de Adhesión',
    'soloAutocultivador', false,
    'texto', $doc1$FORMULARIO DE ADHESIÓN DE SOCIO

Asociación Civil Green Level – Ley 27.350 y Decreto Reglamentario N° 883/2020

1. DATOS PERSONALES

Apellido y Nombre: [NOMBRE COMPLETO]
DNI / Pasaporte N°: [DNI]
Fecha de Nacimiento: [FECHA DE NACIMIENTO]
Nacionalidad: [NACIONALIDAD]
Estado Civil: [ESTADO CIVIL]
Domicilio real: [DOMICILIO REAL]
Localidad: [LOCALIDAD]
Provincia: [PROVINCIA]
Código Postal: [CÓDIGO POSTAL]
Teléfono / WhatsApp: [TELÉFONO]
Correo electrónico: [EMAIL]
CUIL/CUIT: [CUIL]

2. CATEGORÍA DE SOCIO SOLICITADA

Socio [CATEGORÍA]
Plan: [PLAN]

3. INFORMACIÓN MÉDICA Y REPROCANN

¿Posee inscripción en REPROCANN?: [REPROCANN]
Categoría REPROCANN: [CATEGORÍA REPROCANN]
N° de credencial REPROCANN: [CREDENCIAL REPROCANN]
Fecha de vencimiento credencial: [VENCIMIENTO REPROCANN]
Médico tratante: [MÉDICO TRATANTE]
Especialidad / Institución: [ESPECIALIDAD]
Diagnóstico / patología principal: [DIAGNÓSTICO]
Producto prescripto: [PRODUCTO PRESCRIPTO]
Dosis mensual indicada: [DOSIS MENSUAL]

La documentación (DNI frente y dorso, credencial REPROCANN vigente y receta médica con cantidades prescriptas) se adjunta en el formulario digital de alta y forma parte integrante del presente.

4. DECLARACIÓN DEL SOLICITANTE Y CONSENTIMIENTO DE DATOS

El/La solicitante declara conocer y aceptar el Estatuto y Reglamento Interno de la Asociación Civil Green Level, comprometiéndose a cumplir las obligaciones que de ellos surjan, en el marco de la Ley N° 27.350 y sus normas complementarias.

Asimismo, en cumplimiento de la Ley N° 25.326 de Protección de Datos Personales, el/la solicitante presta consentimiento expreso, libre e informado para el tratamiento de sus datos personales y datos sensibles de salud por parte de la Asociación Civil Green Level, con las siguientes finalidades exclusivas:

• Gestión administrativa de la membresía.
• Seguimiento del proceso de cultivo y dispensación.
• Comunicaciones institucionales internas.
• Cumplimiento de obligaciones legales y regulatorias ante organismos competentes.

Los datos no serán cedidos a terceros salvo obligación legal. El titular tiene derecho a acceder, rectificar y suprimir sus datos, dirigiendo su solicitud al correo greenlevelac@gmail.com.

El/La solicitante declara que toda la información aportada es veraz y completa, y que el cannabis obtenido será utilizado exclusivamente con los fines medicinales o terapéuticos que motivaron su inscripción.

Lugar y fecha: Monte Grande, [FECHA]

Firma electrónica del solicitante: [NOMBRE COMPLETO] – DNI [DNI]$doc1$
  ),
  jsonb_build_object(
    'titulo', 'Contrato de Membresía',
    'soloAutocultivador', false,
    'texto', $doc2$CONTRATO DE MEMBRESÍA

Asociación Civil Green Level – Ley N° 27.350, Dec. N° 883/2020 y Res. N° 1780/2025 MS

En la ciudad de Monte Grande, Partido de Esteban Echeverría, Provincia de Buenos Aires, [FECHA LARGA], entre:

LA ASOCIACIÓN: Asociación Civil Green Level, CUIT N° 30-71852913-8, Personería Jurídica N° 49815, con domicilio legal en Cristóbal Colón 941, Monte Grande, Pcia. de Buenos Aires, domicilio electrónico: greenlevelac@gmail.com, representada en este acto por su Presidente, Sr. Lautaro Méndez, DNI N° 35.365.127;

EL/LA SOCIO/A: Sr./Sra. [NOMBRE COMPLETO], DNI N° [DNI], con domicilio en [DOMICILIO], domicilio electrónico: [EMAIL], en adelante indistintamente denominado/a "el/la Socio/a";

acuerdan celebrar el presente Contrato de Membresía conforme a las siguientes cláusulas:

PRIMERA. OBJETO

El presente contrato formaliza la incorporación de el/la Socio/a a la Asociación Civil Green Level en carácter de miembro [CATEGORÍA], con el fin de acceder a los servicios de cultivo asociativo, dispensación y acompañamiento en el uso medicinal y/o terapéutico del cannabis, conforme a la Ley N° 27.350, el Decreto Reglamentario N° 883/2020 y la Resolución N° 1780/2025 del Ministerio de Salud de la Nación.

SEGUNDA. DERECHOS DEL/LA SOCIO/A

a) Acceder a las prestaciones, asesoramiento y acompañamiento brindados por la Asociación en el marco normativo vigente.
b) Participar en actividades, talleres y capacitaciones organizadas por la Asociación.
c) Recibir acompañamiento en la gestión de su inscripción o renovación ante el REPROCANN.
d) Ser informado/a sobre el estado de su cultivo y recibir el producido según la prescripción médica vigente.
e) Acceder a su historia de dispensación en los registros de la Asociación.

TERCERA. OBLIGACIONES DEL/LA SOCIO/A

a) Aportar información médica veraz, completa y actualizada, y mantener vigente la documentación presentada al momento de la adhesión.
b) Mantener vigente su credencial REPROCANN y comunicar fehacientemente a la Asociación cualquier modificación de su situación ante dicho registro.
c) Cumplir con el Estatuto, Reglamento Interno y Manual de Buenas Prácticas de la Asociación.
d) Abonar en tiempo y forma la cuota social mensual de [CUOTA MENSUAL] (Pesos [CUOTA EN LETRAS]), correspondiente al plan [PLAN], entre los días 1 y 5 de cada mes, pudiendo dicho valor ser actualizado por la Asociación con un preaviso de 15 días.
e) Abstenerse de desviar el cannabis recibido hacia fines recreativos, comerciales o ilícitos. El incumplimiento de esta obligación habilitará la rescisión inmediata del contrato y podrá ser comunicado a las autoridades competentes.
f) Notificar a la Asociación con no menos de 30 días de anticipación su intención de dar de baja la membresía.

CUARTA. CUOTA SOCIAL Y MORA

La cuota social mensual se establece en [CUOTA MENSUAL] (Pesos [CUOTA EN LETRAS]). La falta de pago en el plazo convenido producirá la mora automática, sin necesidad de interpelación previa, devengándose un interés punitorio equivalente a la tasa activa del Banco de la Nación Argentina vigente al momento del incumplimiento. El atraso superior a 60 días en el pago de la cuota habilitará a la Asociación a suspender los servicios y, de persistir el incumplimiento por 90 días, a rescindir el contrato.

QUINTA. VIGENCIA, RENOVACIÓN Y RESCISIÓN

El presente contrato tendrá vigencia anual desde la fecha de suscripción, renovándose automáticamente por períodos iguales, salvo que cualquiera de las partes notifique por escrito su voluntad de no renovarlo con no menos de 30 días de anticipación al vencimiento.

La Asociación podrá rescindir el presente contrato en forma inmediata y con causa en los siguientes supuestos:

• Pérdida de vigencia o revocación de la credencial REPROCANN del/la Socio/a.
• Incumplimiento de cualquiera de las obligaciones esenciales establecidas en la Cláusula Tercera.
• Conducta que comprometa la legalidad de la Asociación o afecte a terceros socios.
• Mora superior a 90 días en el pago de la cuota social.

SEXTA. CONFIDENCIALIDAD Y PROTECCIÓN DE DATOS PERSONALES

Toda información personal y médica aportada por el/la Socio/a será tratada con estricta confidencialidad, en cumplimiento de la Ley N° 25.326 de Protección de Datos Personales y su Decreto Reglamentario N° 1558/2001.

Los datos sensibles de salud serán utilizados exclusivamente para la gestión de la membresía, el seguimiento del proceso de cultivo y dispensación, y el cumplimiento de obligaciones legales. No serán cedidos a terceros salvo obligación legal expresa. El/la Socio/a tiene derecho a acceder, rectificar y suprimir sus datos, solicitándolo al correo greenlevelac@gmail.com.

SÉPTIMA. RESPONSABILIDAD Y MARCO LEGAL

La Asociación actúa en el marco exclusivo de la Ley N° 27.350 y sus normas reglamentarias. El cannabis cultivado y dispensado tiene finalidad exclusivamente medicinal y/o terapéutica. Queda expresamente prohibido a el/la Socio/a cualquier acto que implique comercialización, distribución a terceros no autorizados o desviación del producto hacia fines distintos a los prescritos médicamente.

El/La Socio/a asume plena responsabilidad por el uso que haga del cannabis recibido, eximiendo a la Asociación de toda responsabilidad derivada de un uso contrario a lo prescripto.

OCTAVA. JURISDICCIÓN

Para todas las cuestiones judiciales y extrajudiciales derivadas del presente contrato, las partes se someten a la jurisdicción de los Tribunales Ordinarios del Departamento Judicial de Lomas de Zamora, Provincia de Buenos Aires, renunciando a cualquier otro fuero que pudiera corresponderles.

En prueba de conformidad, el/la Socio/a lo acepta mediante firma electrónica en el lugar y fecha indicados al comienzo del presente, quedando registro digital del texto aceptado, del cual podrá solicitar copia a la Asociación.

Por la Asociación: Asociación Civil Green Level – Lautaro Méndez, Presidente – DNI 35.365.127
El/La Socio/a: [NOMBRE COMPLETO] – DNI [DNI]


DECLARACIÓN JURADA DEL/LA SOCIO/A

Yo, [NOMBRE COMPLETO], DNI N° [DNI], con domicilio en [DOMICILIO], declaro bajo juramento que:

• Requiero cannabis con fines exclusivamente medicinales y/o terapéuticos, conforme la prescripción de mi médico tratante.
• La documentación médica aportada es auténtica, vigente y completa.
• No utilizaré el cannabis provisto con fines recreativos, comerciales ni ilícitos, bajo apercibimiento de las responsabilidades penales y civiles que pudieren corresponder.
• Me comprometo a respetar la Ley N° 27.350, sus normas reglamentarias, el Estatuto y el Reglamento Interno de la Asociación Civil Green Level.
• Informaré fehacientemente a la Asociación cualquier modificación en mi situación médica, mi credencial REPROCANN o mis datos personales, dentro de los 10 días de producida la misma.
• Conozco y acepto que la falsedad de cualquier dato declarado podrá dar lugar a la rescisión inmediata del contrato y a la comunicación a las autoridades competentes.

Lugar y fecha: Monte Grande, [FECHA]

Firma electrónica del/la Socio/a: [NOMBRE COMPLETO] – DNI [DNI]$doc2$
  ),
  jsonb_build_object(
    'titulo', 'Contrato de Locación de Servicios – Autocultivadores',
    'soloAutocultivador', true,
    'texto', $doc3$CONTRATO DE LOCACIÓN DE SERVICIOS

Asociación Civil Green Level – Autocultivador REPROCANN

Ley N° 27.350 – Dec. N° 883/2020 – Res. N° 1780/2025 MS

En la ciudad de Monte Grande, Partido de Esteban Echeverría, Provincia de Buenos Aires, [FECHA LARGA], entre:

LA ASOCIACIÓN: Asociación Civil Green Level, CUIT N° 30-71852913-8, Personería Jurídica N° 49815, con domicilio legal en Cristóbal Colón 941, Monte Grande, Pcia. de Buenos Aires, domicilio electrónico: greenlevelac@gmail.com, representada en este acto por su Presidente, Sr. Lautaro Méndez, DNI N° 35.365.127;

EL/LA AUTOCULTIVADOR/A: Sr./Sra. [NOMBRE COMPLETO], DNI N° [DNI], con domicilio en [DOMICILIO], domicilio electrónico: [EMAIL]; en adelante "el/la Autocultivador/a";

Ambos denominados en conjunto "las Partes", acuerdan celebrar el presente Contrato de Locación de Servicios, que se regirá por las cláusulas siguientes:

PRELIMINAR – DECLARACIONES

LA ASOCIACIÓN es una asociación civil debidamente registrada, cuyo objeto social comprende la gestión solidaria de cultivos de cannabis de uso medicinal, terapéutico y/o paliativo del dolor, conforme la Ley N° 27.350, el Decreto N° 883/2020 y la Resolución N° 1780/2025 del Ministerio de Salud de la Nación.

EL/LA AUTOCULTIVADOR/A declara:

• Ser mayor de edad, plenamente capaz.
• Contar con indicación médica para el consumo de cannabis y sus derivados.
• Haber completado su inscripción ante el REPROCANN en la categoría "autocultivador" (credencial N° [CREDENCIAL REPROCANN], vigente hasta el [VENCIMIENTO REPROCANN]), aportando en el formulario digital de alta copia de su credencial vigente (Anexo I) y copia de la receta médica con cantidades prescriptas (Anexo II).
• Que, por razones personales, técnicas, de seguridad, habitabilidad y/o convivencia, su domicilio particular no resulta apto para el ejercicio del cultivo autorizado, por lo que ha decidido declarar como predio de cultivo ante el REPROCANN el vivero de la Asociación, a fin de continuar ejerciendo su derecho al autocultivo dentro del marco normativo vigente.

Las Partes dejan expresa constancia de que el presente contrato no implica delegación de la condición de autocultivador ni transferencia de la titularidad del cultivo. El/la Autocultivador/a mantiene la plena responsabilidad jurídica y administrativa derivada de su inscripción ante REPROCANN. La Asociación se limita a brindar infraestructura, soporte técnico y acompañamiento conforme lo aquí pactado.

PRIMERA. OBJETO

La Asociación prestará al/la Autocultivador/a los servicios de infraestructura y asistencia técnica para el cultivo de cannabis medicinal descriptos en la Cláusula Cuarta, en el predio ubicado en Cristóbal Colón 941, Monte Grande, Pcia. de Buenos Aires.

SEGUNDA. PARCELA ASIGNADA Y PRODUCCIÓN ESTIMADA

Plan contratado: [PLAN AUTOCULTIVO]
Superficie asignada: [SUPERFICIE]
Producción estimada: hasta [PRODUCCIÓN] de flores secas / mes
Variedad / genotipo: a determinar según prescripción médica

La producción estimada indicada precedentemente es orientativa y no constituye garantía de resultado. La Asociación no será responsable por mermas derivadas de factores naturales, plagas, condiciones climáticas adversas u otras circunstancias fuera de su control razonable.

TERCERA. NO MODIFICACIÓN DEL PREDIO DECLARADO

El/la Autocultivador/a se obliga a mantener declarado ante REPROCANN el predio de la Asociación durante toda la vigencia del contrato, y a no modificarlo sin consentimiento previo, expreso y escrito de la Asociación. La modificación unilateral del predio declarado constituirá incumplimiento esencial y habilitará la rescisión del contrato, con más una cláusula penal equivalente a tres (3) meses de retribución vigente.

Asimismo, el/la Autocultivador/a deberá mantener vigente su credencial REPROCANN durante toda la vigencia contractual, siendo de su exclusiva responsabilidad su renovación en tiempo y forma, con preaviso a la Asociación de no menos de 60 días antes del vencimiento.

CUARTA. SERVICIOS INCLUIDOS

La Asociación brindará al/la Autocultivador/a los siguientes servicios:

• Uso y goce de la parcela asignada según Cláusula Segunda, con acceso a infraestructura de cultivo (iluminación, riego y ventilación según plan contratado).
• Asistencia técnica en todas las etapas del ciclo productivo: clonado, vegetación, floración, cosecha, secado y curado.
• Asesoramiento sobre selección de variedad, técnicas de cultivo y gestión de la producción.
• Trazabilidad del proceso productivo y documentación de cada etapa conforme a buenas prácticas agrícolas (GAP).

El acceso a las instalaciones por parte del/la Autocultivador/a deberá coordinarse con la Asociación mediante comunicación previa de al menos 48 horas, sujeto a disponibilidad operativa del predio. El ejercicio de este derecho estará supeditado a que el/la Autocultivador/a se encuentre al día con sus obligaciones contractuales.

El producido del cultivo pertenecerá al/la Autocultivador/a. Para su retiro, deberá presentarse personalmente con su credencial REPROCANN vigente y coordinar el retiro con la Asociación con al menos 48 horas de anticipación.

La Asociación no se responsabiliza por pérdidas de cosecha derivadas de factores fuera de su control razonable (siniestros, robos, condiciones climáticas extremas, plagas). Tampoco garantiza una producción mínima, dada la naturaleza biológica del cultivo.

QUINTA. VIGENCIA

El presente contrato tendrá vigencia de un (1) año desde su suscripción, renovable por períodos iguales mediante acuerdo escrito de las Partes, siempre que el/la Autocultivador/a mantenga vigente su credencial REPROCANN.

SEXTA. RETRIBUCIÓN

Las Partes convienen una retribución mensual de [CUOTA MENSUAL] (Pesos [CUOTA EN LETRAS]), abonada entre los días 1 y 5 de cada mes.

La Asociación emitirá la factura legal correspondiente al cierre de cada mes. Dicho valor podrá ser actualizado con un preaviso mínimo de 15 días, notificando al domicilio electrónico del/la Autocultivador/a.

SÉPTIMA. MORA AUTOMÁTICA

La falta de pago en el plazo convenido producirá mora automática sin necesidad de interpelación previa. Se aplicará un interés punitorio equivalente a la tasa activa del Banco de la Nación Argentina vigente al momento del incumplimiento. El atraso de más de 30 días habilitará a la Asociación a suspender los servicios; superados los 60 días, a resolver el contrato.

OCTAVA. RESCISIÓN SIN EXPRESIÓN DE CAUSA

Cualquiera de las Partes podrá rescindir el contrato sin expresión de causa, notificando fehacientemente a la otra con una antelación de:

• 30 días, si la parte rescindente es el/la Autocultivador/a.
• 30 días, si la parte rescindente es la Asociación.

Producida la rescisión, el/la Autocultivador/a dispondrá de 10 días hábiles para retirar el producido existente en el predio. Vencido dicho plazo sin que se realizara el retiro, la Asociación quedará facultada para disponer del producido conforme sus propios criterios, sin responsabilidad ni obligación de indemnización.

NOVENA. RESOLUCIÓN CON CAUSA

La Asociación podrá resolver el contrato de pleno derecho mediante notificación fehaciente en los siguientes supuestos:

• Modificación del predio declarado ante REPROCANN sin consentimiento de la Asociación.
• Pérdida de vigencia, suspensión o revocación de la credencial REPROCANN.
• Mora superior a 60 días en el pago de la retribución.
• Incumplimiento de cualquier obligación esencial del presente contrato.

La resolución con causa producirá efectos inmediatos desde la notificación y no generará derecho a compensación alguna para el/la Autocultivador/a, sin perjuicio de la cláusula penal prevista en la Cláusula Tercera y de los daños adicionales que correspondieren.

DÉCIMA. INDEMNIDAD RECÍPROCA

Las Partes mantendrán indemne a la otra de todo reclamo, daño, perjuicio, honorario o costo legal derivado de la actuación de sus propios dependientes, contratados o subcontratados. El presente contrato no genera relación de dependencia entre las Partes ni entre sus integrantes.

UNDÉCIMA. CONFIDENCIALIDAD Y DATOS PERSONALES

Las Partes se obligan a mantener confidencialidad sobre toda información médica, técnica y operativa intercambiada en el marco del presente contrato. El tratamiento de datos personales y datos sensibles se realizará conforme a la Ley N° 25.326 y sus normas reglamentarias.

DUODÉCIMA. PROHIBICIÓN DE CESIÓN

El presente contrato no podrá ser cedido por ninguna de las Partes, en atención a su naturaleza personal e intransferible.

DECIMOTERCERA. JURISDICCIÓN Y DOMICILIOS

Para todas las cuestiones judiciales y extrajudiciales derivadas del presente contrato, las Partes se someten a la jurisdicción de los Tribunales Ordinarios del Departamento Judicial de Lomas de Zamora, Provincia de Buenos Aires, con renuncia a cualquier otro fuero. Los domicilios constituidos son los indicados en el encabezado del presente, siendo válidas todas las notificaciones que allí se practiquen.

En prueba de conformidad, el/la Autocultivador/a lo acepta mediante firma electrónica en el lugar y fecha indicados, quedando registro digital del texto aceptado, del cual podrá solicitar copia a la Asociación.

Por la Asociación: Asociación Civil Green Level – Lautaro Méndez, Presidente – DNI 35.365.127
El/La Autocultivador/a: [NOMBRE COMPLETO] – DNI [DNI]$doc3$
  )
)
where slug = 'greenlevel';
