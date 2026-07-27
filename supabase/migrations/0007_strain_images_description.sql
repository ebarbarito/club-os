-- Varias fotos por genética (carrusel en el sitio público) + descripción
-- larga aparte de la ficha técnica corta (aroma/efectos/cruza).
alter table strains
  add column images text[] not null default '{}',
  add column description text;
