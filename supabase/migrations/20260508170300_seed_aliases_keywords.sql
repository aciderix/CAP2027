insert into public.candidate_aliases (candidate_id, alias)
select c.id, a.alias
from (values
  ('jean-martin', 'Jean Martin'),
  ('jean-martin', 'M. Martin'),
  ('jean-martin', 'président Martin'),
  ('jean-martin', 'le président Martin'),
  ('claire-dubois', 'Claire Dubois'),
  ('claire-dubois', 'Mme Dubois'),
  ('claire-dubois', 'la candidate Dubois'),
  ('antoine-lefevre', 'Antoine Lefèvre'),
  ('antoine-lefevre', 'Antoine Lefevre'),
  ('antoine-lefevre', 'M. Lefèvre'),
  ('antoine-lefevre', 'M. Lefevre')
) as a(slug, alias)
join public.candidates c on c.slug = a.slug;

insert into public.party_aliases (party_id, alias)
select p.id, a.alias
from (values
  ('renaissance', 'Renaissance'),
  ('renaissance', 'majorité présidentielle'),
  ('renaissance', 'macronistes'),
  ('renaissance', 'macroniste'),
  ('verts-unis', 'Verts Unis'),
  ('verts-unis', 'écologistes'),
  ('verts-unis', 'EELV'),
  ('union-citoyenne', 'Union Citoyenne'),
  ('union-citoyenne', 'centristes'),
  ('union-citoyenne', 'centriste')
) as a(slug, alias)
join public.parties p on p.abbreviation = case a.slug
  when 'renaissance' then 'REN'
  when 'verts-unis' then 'PVU'
  when 'union-citoyenne' then 'UC'
end;

insert into public.theme_keywords (theme_id, keyword)
select t.id, k.keyword
from (values
  ('ecologie', 'écologie'),  ('ecologie', 'écologique'), ('ecologie', 'environnement'),
  ('ecologie', 'climat'),    ('ecologie', 'climatique'),  ('ecologie', 'biodiversité'),
  ('ecologie', 'nucléaire'), ('ecologie', 'EPR'),         ('ecologie', 'renouvelable'),
  ('ecologie', 'éolien'),    ('ecologie', 'solaire'),     ('ecologie', 'pollution'),
  ('ecologie', 'carbone'),   ('ecologie', 'CO2'),
  ('ecologie', 'transition énergétique'), ('ecologie', 'transition écologique'),
  ('ecologie', 'pesticide'), ('ecologie', 'néonicotinoïde'),
  ('ecologie', 'ZFE'),       ('ecologie', 'ZAN'),

  ('economie', 'économie'),  ('economie', 'économique'), ('economie', 'budget'),
  ('economie', 'déficit'),   ('economie', 'dette publique'), ('economie', 'croissance'),
  ('economie', 'PIB'),       ('economie', 'inflation'),  ('economie', 'fiscalité'),
  ('economie', 'fiscal'),    ('economie', 'impôt'),      ('economie', 'impôts'),
  ('economie', 'TVA'),       ('economie', 'CSG'),        ('economie', 'ISF'),
  ('economie', 'taxe'),      ('economie', 'pouvoir d''achat'),
  ('economie', 'industrie'), ('economie', 'réindustrialisation'),
  ('economie', 'PME'),       ('economie', 'apprentissage'), ('economie', 'apprentis'),

  ('social', 'retraite'),    ('social', 'retraites'),    ('social', 'pension'),
  ('social', 'pensions'),    ('social', 'chômage'),      ('social', 'SMIC'),
  ('social', 'salaire minimum'), ('social', 'logement'), ('social', 'logements'),
  ('social', 'allocation'),  ('social', 'allocations'),  ('social', 'RSA'),
  ('social', 'APL'),
  ('social', 'congé parental'), ('social', 'congé paternité'),
  ('social', 'crèche'),      ('social', 'crèches'),      ('social', 'précarité'),
  ('social', 'pauvreté'),    ('social', 'inégalités'),

  ('securite', 'sécurité'),  ('securite', 'police'),     ('securite', 'policier'),
  ('securite', 'policiers'), ('securite', 'gendarme'),   ('securite', 'gendarmerie'),
  ('securite', 'délinquance'), ('securite', 'criminalité'),
  ('securite', 'violences urbaines'), ('securite', 'prison'), ('securite', 'prisons'),
  ('securite', 'magistrat'), ('securite', 'magistrats'), ('securite', 'justice'),
  ('securite', 'terrorisme'),('securite', 'narcotrafic'),('securite', 'stupéfiants'),
  ('securite', 'vidéoprotection'), ('securite', 'vidéosurveillance'),

  ('sante', 'santé'),        ('sante', 'hôpital'),       ('sante', 'hôpitaux'),
  ('sante', 'hospitalier'),  ('sante', 'soignant'),      ('sante', 'soignants'),
  ('sante', 'médecin'),      ('sante', 'médecins'),
  ('sante', 'maison de santé'), ('sante', 'désert médical'),
  ('sante', 'sécurité sociale'), ('sante', 'assurance maladie'),
  ('sante', 'CPAM'),         ('sante', 'ARS'),
  ('sante', 'santé mentale'),('sante', 'psychiatrie'),
  ('sante', 'EHPAD'),        ('sante', 'pharmacie'),

  ('education', 'éducation'),('education', 'école'),     ('education', 'écoles'),
  ('education', 'collège'),  ('education', 'collèges'),  ('education', 'lycée'),
  ('education', 'lycées'),   ('education', 'université'),('education', 'universités'),
  ('education', 'enseignant'), ('education', 'enseignants'),
  ('education', 'professeur'), ('education', 'professeurs'),
  ('education', 'étudiant'),  ('education', 'étudiants'),
  ('education', 'Parcoursup'),('education', 'BTS'),      ('education', 'baccalauréat'),
  ('education', 'apprentissage scolaire'),

  ('europe', 'Europe'),      ('europe', 'européen'),     ('europe', 'européenne'),
  ('europe', 'européens'),   ('europe', 'européennes'),  ('europe', 'Union européenne'),
  ('europe', 'Bruxelles'),   ('europe', 'Strasbourg'),
  ('europe', 'Commission européenne'), ('europe', 'Parlement européen'),
  ('europe', 'eurodéputé'),  ('europe', 'CETA'),         ('europe', 'Mercosur'),
  ('europe', 'Schengen'),    ('europe', 'OTAN'),
  ('europe', 'élargissement européen'), ('europe', 'PAC')
) as k(theme_slug, keyword)
join public.themes t on t.slug = k.theme_slug;
