-- ============================================================================
-- WVSU WAYFINDER: COMPLETE FACULTY DIRECTORY IMPORT
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Allow UDE to be represented as an academic unit in public.places.
-- ----------------------------------------------------------------------------
ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS places_kind_check;

ALTER TABLE public.places
  ADD CONSTRAINT places_kind_check
  CHECK (
    kind = ANY (
      ARRAY[
        'building'::text,
        'room'::text,
        'office'::text,
        'college'::text,
        'unit'::text,
        'landmark'::text
      ]
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Replace department with position_title without adding a second column.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  has_department boolean;
  has_position_title boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'faculty'
      AND column_name = 'department'
  ) INTO has_department;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'faculty'
      AND column_name = 'position_title'
  ) INTO has_position_title;

  IF has_department AND has_position_title THEN
    RAISE EXCEPTION
      'Both department and position_title exist in public.faculty. '
      'Please reconcile those columns before running this import.';
  ELSIF has_department THEN
    ALTER TABLE public.faculty
      RENAME COLUMN department TO position_title;
  ELSIF NOT has_position_title THEN
    ALTER TABLE public.faculty
      ADD COLUMN position_title text;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. Create the college/unit place records used by faculty.college_id.
--    Existing place records with the same IDs are not overwritten.
-- ----------------------------------------------------------------------------
INSERT INTO public.places (
  id,
  kind,
  name,
  short_name,
  status,
  source,
  verified_by,
  verified_at
)
VALUES
  ('CAS', 'college', 'College of Arts and Sciences', 'CAS', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('CBM', 'college', 'College of Business and Management', 'CBM', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('CICT', 'college', 'College of Information and Communications Technology', 'CICT', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('COC', 'college', 'College of Communication', 'COC', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('COD', 'college', 'College of Dentistry', 'COD', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('COE', 'college', 'College of Education', 'COE', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('COL', 'college', 'College of Law', 'COL', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('COM', 'college', 'College of Medicine', 'COM', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('CON', 'college', 'College of Nursing', 'CON', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('COP', 'college', 'College of Physical Education, Sports, Culture, Recreation, and Arts', 'COP', 'verified', 'WVSU Human Resources', 'WayFinder Team', now()),
  ('UDE', 'unit', 'University Distance Education', 'UDE', 'verified', 'WVSU Human Resources', 'WayFinder Team', now())
ON CONFLICT (id) DO NOTHING;

-- Confirm that each ID exists and has the expected kind.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('CAS', 'college'),
        ('CBM', 'college'),
        ('CICT', 'college'),
        ('COC', 'college'),
        ('COD', 'college'),
        ('COE', 'college'),
        ('COL', 'college'),
        ('COM', 'college'),
        ('CON', 'college'),
        ('COP', 'college'),
        ('UDE', 'unit')
    ) AS expected(id, expected_kind)
    LEFT JOIN public.places AS p
      ON p.id = expected.id
    WHERE p.id IS NULL
       OR p.kind <> expected.expected_kind
  ) THEN
    RAISE EXCEPTION
      'One or more faculty college/unit place IDs are missing or have an unexpected kind.';
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 4. Staging table.
--    Use a regular table (not a session-only TEMP table) because some SQL
--    editor execution modes run statements in separate transactions/sessions.
--    It is locked down and dropped at the end of this script.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public._wayfinder_faculty_import_stage;

CREATE TABLE public._wayfinder_faculty_import_stage (
  full_name       text NOT NULL,
  position_title  text NOT NULL,
  college_code    text NOT NULL,
  official_email  text NOT NULL
);

REVOKE ALL ON TABLE public._wayfinder_faculty_import_stage
  FROM PUBLIC, anon, authenticated;

INSERT INTO public._wayfinder_faculty_import_stage (
  full_name,
  position_title,
  college_code,
  official_email
)
VALUES
  ('ABALEÑA, RICKY III G.', 'Professor VI', 'COC', 'ricjourn@wvsu.edu.ph'),
  ('ABIODA, CARESSA JOYCE G.', 'Instructor III', 'CBM', 'caressajoyce.abioda@wvsu.edu.ph'),
  ('ABIODA, KERVIN MARC D.', 'Assistant Professor III', 'CBM', 'kmabioda@wvsu.edu.ph'),
  ('ABRICO, PAULO C.', 'Associate Professor III', 'COP', 'paulo.abrico@wvsu.edu.ph'),
  ('ABUNYAWAN, BRAINARD B.', 'Instructor III', 'CAS', 'brainard.abunyawan@wvsu.edu.ph'),
  ('ACOSTA, NEOLY ORCHID O.', 'Assistant Professor I', 'CON', 'neolyorchid.acosta@wvsu.edu.ph'),
  ('AGUARAS, MAE S.', 'Assistant Professor I', 'CON', 'maeaguaras@wvsu.edu.ph'),
  ('ALABADO, LIZA GRACE T.', 'Assistant Professor II', 'COM', 'lizaalabado@wvsu.edu.ph'),
  ('ALAYON, STEPHEN B.', 'Associate Professor IV', 'CICT', 'stephen.alayon@wvsu.edu.ph'),
  ('ALBACETE, VICTORIA V.', 'Associate Professor V', 'COE', 'victoria.albacete@wvsu.edu.ph'),
  ('ALCALA, LYNETTE F.', 'Associate Professor III', 'COM', 'lynette.alcala@wvsu.edu.ph'),
  ('ALFECHE, MARY GISELLE S.', 'Assistant Professor IV', 'COM', 'mgalfeche@wvsu.edu.ph'),
  ('ALIMOJANE, ERICKA T.', 'Instructor III', 'CICT', 'ericka.alimojane@wvsu.edu.ph'),
  ('ALINGASA, RONA DHEL C.', 'Associate Professor II', 'COC', 'alingasa.rdc@wvsu.edu.ph'),
  ('ALMONTE, MARIA KRISTINA G.', 'Assistant Professor IV', 'COM', 'mk.almonte@wvsu.edu.ph'),
  ('AMANTILLO, VICTOR JR., A.', 'Associate Professor V', 'COM', 'victorjr.amantillo@wvsu.edu.ph'),
  ('AMORSOLO, KARMINA A.', 'Instructor III', 'CBM', 'karmina.amorsolo@wvsu.edu.ph'),
  ('ANDRADA, PRIMROSE A.', 'Assistant Professor I', 'CON', 'primrose.andrada@wvsu.edu.ph'),
  ('APAYA, MARIA KARMELLA L.', 'Professor II', 'CAS', 'makarmella.apaya@wvsu.edu.ph'),
  ('APILADO, ALBERT C.', 'Associate Professor V', 'CON', 'aapilado@wvsu.edu.ph'),
  ('ARANAS, JOESYL MARIE D.', 'Instructor III', 'COC', 'joesyl.aranas@wvsu.edu.ph'),
  ('ARMADA, KEIA JOY H.', 'Instructor III', 'CICT', 'keiajoy.harder@wvsu.edu.ph'),
  ('AURO, RITCHELDA A.', 'Associate Professor II', 'CAS', 'ritchelda.auro@wvsu.edu.ph'),
  ('AVENTURA, CHARMANE Q.', 'Assistant Professor I', 'CON', 'charmane.aventura@wvsu.edu.ph'),
  ('BACIO, SALVADOR JR., P.', 'Associate Professor V', 'COE', 'salvador.bacio@wvsu.edu.ph'),
  ('BAGA-AN, ANABELLE L.', 'Associate Professor V', 'CAS', 'anabelle.bagaan@wvsu.edu.ph'),
  ('BAGAFORO, MA. ROSVIA B.', 'Assistant Professor I', 'COD', 'marosvia.bagaforo@wvsu.edu.ph'),
  ('BAGARINAO, CATHRINA F.', 'Instructor III', 'CAS', 'cathrina.bagarinao@wvsu.edu.ph'),
  ('BAJADOR, MA. NENITTE T.', 'Associate Professor I', 'COP', 'nbajador@wvsu.edu.ph'),
  ('BALINSOY, SHEENA P.', 'Instructor III', 'CAS', 'sheena.balinsoy@wvsu.edu.ph'),
  ('BALLARET, JEFFREY R.', 'Professor I', 'CAS', 'jeffrey.ballaret@wvsu.edu.ph'),
  ('BALSOMO, ALEXANDER J.', 'Associate Professor V', 'CAS', 'abalsomo@wvsu.edu.ph'),
  ('BALURAN, CLAUDETTE A.', 'Professor V', 'CAS', 'claudette.baluran@wvsu.edu.ph'),
  ('BAÑAS, CHARMY JUNE A.', 'Instructor III', 'CAS', 'charmyjune.almaquer@wvsu.edu.ph'),
  ('BANGERO, JOENER B.', 'Assistant Professor II', 'COM', 'joener.bangero@wvsu.edu.ph'),
  ('BARLAS, PORFERIO JR., J.', 'Associate Professor V', 'COP', 'porferio.barlasjr@wvsu.edu.ph'),
  ('BASBAS, JAN IRIS FAYE M.', 'Assistant Professor IV', 'COE', 'jifbasbas@wvsu.edu.ph'),
  ('BATAGA, NOE D.', 'Assistant Professor III', 'COM', 'noe.bataga@wvsu.edu.ph'),
  ('BAYLON, ED CHARLES JOHN R.', 'Instructor III', 'CAS', 'edcharles.baylon@wvsu.edu.ph'),
  ('BAYO-ANG, MARICAR A.', 'Assistant Professor II', 'COM', 'maricar.bayoang@wvsu.edu.ph'),
  ('BAYONA, LESLIE MAE C.', 'Instructor III', 'CAS', 'lesliemae.bayona@wvsu.edu.ph'),
  ('BEBIT, FRANK C.', 'Instructor III', 'COE', 'frank.bebit@wvsu.edu.ph'),
  ('BECODO, RICKY P.', 'Professor III', 'COC', 'kyngbecodo@wvsu.edu.ph'),
  ('BELARGA, ALONA M.', 'Professor VI', 'COE', 'abelarga@wvsu.edu.ph'),
  ('BELENO, RAMON III B.', 'Instructor III', 'CAS', 'ramon.beleno@wvsu.edu.ph'),
  ('BELIRAN, SHEILA P.', 'Associate Professor V', 'CON', 'sbeliran@wvsu.edu.ph'),
  ('BERAME, ELI JOHN A.', 'Assistant Professor II', 'COM', 'eli.berame@wvsu.edu.ph'),
  ('BEREZO, LENNIE ROSE R.', 'Assistant Professor II', 'COM', 'lennierose.berezo@wvsu.edu.ph'),
  ('BERNARDO, EMILIANO III M.', 'Assistant Professor II', 'COM', 'emiliano.bernardo@wvsu.edu.ph'),
  ('BESANA, IAN THOMAS M.', 'Assistant Professor II', 'COL', 'ianthomas.besana@wvsu.edu.ph'),
  ('BINOBO, ZENDLE ANN D.', 'Assistant Professor II', 'CBM', 'zbinobo@wvsu.edu.ph'),
  ('BLASE, WYETH IAN C.', 'Instructor III', 'CAS', 'wyethian.blase@wvsu.edu.ph'),
  ('BOLIVAR, JOHN PHILIP M.', 'Instructor III', 'CAS', 'johnphilip.bolivar@wvsu.edu.ph'),
  ('BONOTANO, MARRON AERIELLE J.', 'Instructor III', 'UDE', 'marron.bonotano@wvsu.edu.ph'),
  ('BUBAN, LARRY D.', 'Associate Professor V', 'CAS', 'larrybuban@wvsu.edu.ph'),
  ('BULOHABO, CHRISTIAN ERIC B.', 'Instructor III', 'CAS', 'christianeric.bulohabo@wvsu.edu.ph'),
  ('BUNDA, GLYSA MARIE R.', 'Instructor III', 'COE', 'glysamarie.bunda@wvsu.edu.ph'),
  ('BUSCAR, MARIA REBECCA A.', 'Assistant Professor II', 'CON', 'mariarebecca.buscar@wvsu.edu.ph'),
  ('CAALEM, LADEN JANE P.', 'Instructor III', 'COE', 'ladenjane.caalem@wvsu.edu.ph'),
  ('CABACAS, REGIN A.', 'Professor VI', 'CICT', 'rcabacas@wvsu.edu.ph'),
  ('CABAG, MIL JOE S.', 'Associate Professor III', 'COC', 'mjcabag@wvsu.edu.ph'),
  ('CABAG, ZSA ZSA B.', 'Assistant Professor IV', 'COC', 'zsazsab@wvsu.edu.ph'),
  ('CABALAR, BABELYN C.', 'Instructor III', 'COC', 'babelyn.cabalar@wvsu.edu.ph'),
  ('CABALFIN, LEAH MAE C.', 'Associate Professor V', 'CAS', 'lcabalfin@wvsu.edu.ph'),
  ('CABELARA, WINNIE T.', 'Assistant Professor I', 'CON', 'winnie.cabelara@wvsu.edu.ph'),
  ('CABICO, SHIRLEY D.', 'Associate Professor II', 'CAS', 'scabico@wvsu.edu.ph'),
  ('CABILES, NEÑA VANESSA A.', 'Associate Professor V', 'COE', 'nvcabiles@wvsu.edu.ph'),
  ('CADIAO, ESPERVAL CEZHAR H.', 'Instructor III', 'COE', 'espervalcezhar.cadiao@wvsu.edu.ph'),
  ('CALANZA, LOUISSE MARGARETT S.', 'Assistant Professor I', 'CON', 'louissemargarett.calanza@wvsu.edu.ph'),
  ('CALA-OR, KYTH V.', 'Instructor III', 'CBM', 'kyth.calaor@wvsu.edu.ph'),
  ('CALICA, RYAN H.', 'Instructor III', 'CAS', 'rcalica@wvsu.edu.ph'),
  ('CAMARISTA, GENESIS G.', 'Associate Professor V', 'COE', 'genesis.camarista@wvsu.edu.ph'),
  ('CAÑONASO, MARIE VIC C.', 'Assistant Professor I', 'CON', 'marievic.canonaso@wvsu.edu.ph'),
  ('CANSON, CARYL C.', 'Instructor III', 'COP', 'caryl.canson@wvsu.edu.ph'),
  ('CAPACIETE, MA. JANINE K.', 'Assistant Professor I', 'COD', 'mcapaciete@wvsu.edu.ph'),
  ('CAQUILGAN, ZARAH ELLA C.', 'Instructor III', 'CAS', 'zarahella.caquilgan@wvsu.edu.ph'),
  ('CARDENAS, LESTER JOSEPH G.', 'Assistant Professor II', 'COD', 'lesterjoseph.cardenas@wvsu.edu.ph'),
  ('CARITATIVO, MA. TERESA S.', 'Assistant Professor IV', 'COE', 'mtcaritativo@wvsu.edu.ph'),
  ('CASTAÑO, AARON JOSEPH H.', 'Instructor III', 'CAS', 'aaronjoseph.castano@wvsu.edu.ph'),
  ('CATALAN, IMEE ROSE D.', 'Instructor III', 'CAS', 'imeerose.catalan@wvsu.edu.ph'),
  ('CATEDRAL, LUZSIL M.', 'Assistant Professor II', 'COM', 'luzsil.catedral@wvsu.edu.ph'),
  ('CATEDRILLA, LEONARD T.', 'Instructor III', 'COP', 'leonard.catedrilla@wvsu.edu.ph'),
  ('CELENDRO, FAYE MARGARET F.', 'Instructor III', 'CAS', 'fayemargaret.celendro@wvsu.edu.ph'),
  ('CENDAÑA, DEXTER P.', 'Assistant Professor IV', 'CON', 'dexterpc@wvsu.edu.ph'),
  ('CEPEDA, MA. ERNALYN B.', 'Associate Professor IV', 'COE', 'maernalyn.cepeda@wvsu.edu.ph'),
  ('CERBO, WILHELM P.', 'Professor VI', 'CAS', 'wilhelmcerbo@wvsu.edu.ph'),
  ('CERCADO, MA. TERESA M.', 'Assistant Professor II', 'CON', 'materesa.cercado@wvsu.edu.ph'),
  ('CERDANA, HERMA GRACE S.', 'Assistant Professor II', 'COM', 'hermagrace.cerdana@wvsu.edu.ph'),
  ('CHAN, NATHANIEL H.', 'Associate Professor IV', 'COM', 'nathaniel.chan@wvsu.edu.ph'),
  ('CHIN-BALAJADIA, LINDA MAE C.', 'Assistant Professor II', 'COM', 'lindamae.balajadia@wvsu.edu.ph'),
  ('CHUA, AIMEE G.', 'Assistant Professor IV', 'COM', 'aimee.chua@wvsu.edu.ph'),
  ('CLAUD, FERNAND A.', 'Instructor III', 'CAS', 'fernand.claud@wvsu.edu.ph'),
  ('COCJIN, JASON C.', 'Associate Professor IV', 'CAS', 'jccocjin@wvsu.edu.ph'),
  ('COLACION, RAZEL B.', 'Assistant Professor II', 'COM', 'razel.colacion@wvsu.edu.ph'),
  ('COLLADO, MA. FLORA C.', 'Professor II', 'CBM', 'mcollado@wvsu.edu.ph'),
  ('COLON, JOYCE CHRISTINE D.', 'Assistant Professor III', 'CAS', 'joycechristine.colon@wvsu.edu.ph'),
  ('CONCEPCION, MA. BETH S.', 'Professor VI', 'CICT', 'mbconcepcion@wvsu.edu.ph'),
  ('CONJUSTA, GENEVIEVE R.', 'Associate Professor I', 'COE', 'genevieve.conjusta@wvsu.edu.ph'),
  ('CONSEBIT, SHERBETH H.', 'Associate Professor V', 'COE', 'sherbeth.consebit@wvsu.edu.ph'),
  ('CONTREVIDA, RAMELA O.', 'Associate Professor I', 'COM', 'ramcontrevida@wvsu.edu.ph'),
  ('CORDERO, EVELYN M.', 'Assistant Professor IV', 'COE', 'evelyn.cordero@wvsu.edu.ph'),
  ('CORDERO, MA. CARMELA G.', 'Instructor III', 'COP', 'macarmela.cordero@wvsu.edu.ph'),
  ('CORIENTO, CHRISTINE C.', 'Instructor III', 'COE', 'christine.coriento@wvsu.edu.ph'),
  ('CORNELIO, ANA LIZA C.', 'Assistant Professor II', 'COM', 'analiza.cornelio@wvsu.edu.ph'),
  ('CORTEZ, ANTONIETTE D.', 'Associate Professor II', 'COE', 'acortez@wvsu.edu.ph'),
  ('CUNADA, KAREN MARIE V.', 'Assistant Professor II', 'COM', 'karen.cunada@wvsu.edu.ph'),
  ('DAGUAY, ALMA MARIA B.', 'Assistant Professor II', 'COM', 'almamaria.daguay@wvsu.edu.ph'),
  ('DALMACIO, EMILIO III', 'Instructor III', 'CBM', 'emilio.dalmacioiii@wvsu.edu.ph'),
  ('DAYOT, RALPH VOLTAIRE J.', 'Assistant Professor III', 'CICT', 'ralphvoltaire.dayot@wvsu.edu.ph'),
  ('DAYOT, RUDINIA J.', 'Assistant Professor IV', 'CON', 'rudinia.dayot@wvsu.edu.ph'),
  ('DE LA CRUZ, WINDY T.', 'Instructor III', 'CAS', 'windy.delacruz@wvsu.edu.ph'),
  ('DE LA GENTE, EDGAR R.', 'Assistant Professor III', 'CAS', 'edgardlg@wvsu.edu.ph'),
  ('DE LA VEGA, MARY ANN M.', 'Associate Professor V', 'CAS', 'maryann.delavega@wvsu.edu.ph'),
  ('DE LEON, ROSALEA CORNELIA A.', 'Associate Professor III', 'COE', 'rc_deleon@wvsu.edu.ph'),
  ('DE PIO, SHIM LESTER G.', 'Associate Professor IV', 'CAS', 'sldepio@wvsu.edu.ph'),
  ('DE RAMOS, MARIA JANETTE JASMINE G.', 'Assistant Professor II', 'COM', 'janette.deramos@wvsu.edu.ph'),
  ('DEFANTE, JANINE P.', 'Instructor III', 'CICT', 'jp_defante@wvsu.edu.ph'),
  ('DEGUMA, JON KRISTOFFER E.', 'Assistant Professor II', 'COP', 'jonkristoffer.deguma@wvsu.edu.ph'),
  ('DEJANDO, MICHAEL ANGELO M.', 'Instructor III', 'COE', 'michaelangelo.dejando@wvsu.edu.ph'),
  ('DELA CRUZ, MAY B.', 'Assistant Professor II', 'COE', 'may.delacruz@wvsu.edu.ph'),
  ('DELGADO, CHERYL LYN C.', 'Associate Professor V', 'COE', 'cheryllyn.delgado@wvsu.edu.ph'),
  ('DELGADO, QUEENIE M.', 'Assistant Professor I', 'COD', 'queenie.delgado@wvsu.edu.ph'),
  ('DELOGUINES, ANGELOU B.', 'Assistant Professor I', 'COE', 'angelou.deloguines@wvsu.edu.ph'),
  ('DENUSTA, JONALYN L.', 'Associate Professor II', 'COE', 'jonalyn.denusta@wvsu.edu.ph'),
  ('DENUSTA, PASTOR JONES T.', 'Professor II', 'CAS', 'pastorjones.denusta@wvsu.edu.ph'),
  ('DEOCAMPO, NIKIE JO E.', 'Instructor III', 'CICT', 'nikiejo.deocampo@wvsu.edu.ph'),
  ('DEQUILLA, MA. ASUNCION CHRISTINE', 'Professor VI', 'COE', 'macdequilla@wvsu.edu.ph'),
  ('DIAMANTE, ALEXIS L.', 'Professor III', 'CAS', 'alexis.diamante@wvsu.edu.ph'),
  ('DIAZ, VENUS P.', 'Associate Professor V', 'CAS', 'venus.diaz@wvsu.edu.ph'),
  ('DICHOSA, ROSEMARIE M.', 'Assistant Professor IV', 'CBM', 'rosemarie.dichosa@wvsu.edu.ph'),
  ('DIGNADICE, DENNIS P.', 'Assistant Professor I', 'COM', 'dennis.dignadice@wvsu.edu.ph'),
  ('DIGNADICE, MICHELLE I.', 'Assistant Professor II', 'COM', 'michelle.dignadice@wvsu.edu.ph'),
  ('DIVINAGRACIA, AGUSTIN III G.', 'Assistant Professor IV', 'COE', 'a_divinagracia@wvsu.edu.ph'),
  ('DOFITAS, CYRENEO JR., S.', 'Associate Professor II', 'CICT', 'cdofitas@wvsu.edu.ph'),
  ('DORADO, JONALD B.', 'Instructor III', 'CAS', 'jdorado@wvsu.edu.ph'),
  ('DUMPIT, KAREN ALINOR J.', 'Associate Professor I', 'CICT', 'kadumpit@wvsu.edu.ph'),
  ('DURAN, BESIE A.', 'Assistant Professor III', 'CON', 'besie.duran@wvsu.edu.ph'),
  ('DUREZA, ZENNY MARIE B.', 'Assistant Professor I', 'CON', 'zennymarie.dureza@wvsu.edu.ph'),
  ('ECUBE, MA. ELFLEDA R.', 'Associate Professor IV', 'CAS', 'mecube@wvsu.edu.ph'),
  ('ELECCION, JHON ANTHONY R.', 'Instructor II', 'CICT', 'jhonanthony.eleccion@wvsu.edu.ph'),
  ('ELECHICON, JOEY E.', 'Instructor II', 'CAS', 'joey.elechicon@wvsu.edu.ph'),
  ('ELIJORDE, FRANK I.', 'Professor VI', 'CICT', 'felijorde@wvsu.edu.ph'),
  ('ENICOLA, EDDIE S. JR.', 'Assistant Professor I', 'COD', 'eddie.enicola@wvsu.edu.ph'),
  ('ERUM, MA. CRISTINA L.', 'Associate Professor II', 'COM', 'macristina.erum@wvsu.edu.ph'),
  ('ESCANLAR, DENISE DANAH R.', 'Assistant Professor I', 'CON', 'denisedanah.escanlar@wvsu.edu.ph'),
  ('ESPADA, IAN C.', 'Associate Professor IV', 'COC', 'ian.espada@wvsu.edu.ph'),
  ('ESPIRITU, ANDELYN B.', 'Assistant Professor I', 'CON', 'andelyn.espiritu@wvsu.edu.ph'),
  ('FAULAN, FEJELIA D.', 'Assistant Professor II', 'COM', 'ffaulan@wvsu.edu.ph'),
  ('FEDERISO, VIRGINIA F.', 'Associate Professor V', 'CON', 'virginia.federiso@wvsu.edu.ph'),
  ('FELIMON, ROSEMARIE G.', 'Associate Professor V', 'COE', 'rosemarie.galvez@wvsu.edu.ph'),
  ('FELIPRADA, CHERYLL ANN N.', 'Assistant Professor III', 'CICT', 'cafeliprada@wvsu.edu.ph'),
  ('FERRARIZ, APRIL JOY P.', 'Assistant Professor I', 'COD', 'apriljoy.ferrariz@wvsu.edu.ph'),
  ('FERRER, JOANNA JACINTH R.', 'Instructor III', 'UDE', 'joannajacinth.ferrer@wvsu.edu.ph'),
  ('FIGUERAS, JEANNEMAR GENEVIVE Y.', 'Professor V', 'CAS', 'jeannemargenevive.figueras@wvsu.edu.ph'),
  ('FLORES, REYMUND B.', 'Professor IV', 'CAS', 'reymund.flores@wvsu.edu.ph'),
  ('FUEGO, MICRON REY B.', 'Instructor III', 'COE', 'micron.fuego@wvsu.edu.ph'),
  ('FUNTECHA, HENNEL RHEE S.', 'Instructor III', 'COP', 'hennelrhee.funtecha@wvsu.edu.ph'),
  ('FUNTECHA, RICA MARCET O.', 'Instructor III', 'COC', 'rica.obsequio@wvsu.edu.ph'),
  ('GA-AN, EUNICE C.', 'Instructor III', 'CAS', 'egaan@wvsu.edu.ph'),
  ('GABASA, CHIVE G.', 'Associate Professor V', 'COE', 'cgabasa@wvsu.edu.ph'),
  ('GABAWA, LEA M.', 'Associate Professor II', 'CICT', 'lea.gabawa@wvsu.edu.ph'),
  ('GABAYOYO, RICHARD J.', 'Professor III', 'COP', 'richard.gabayoyo@wvsu.edu.ph'),
  ('GADIAN, GEMMA F.', 'Assistant Professor II', 'COE', 'gemma.gadian@wvsu.edu.ph'),
  ('GAITAN, OBED JOY B.', 'Instructor III', 'COE', 'obed.gaitan@wvsu.edu.ph'),
  ('GAJELES, GHELLYN T.', 'Assistant Professor IV', 'CAS', 'ghellyn.gajeles@wvsu.edu.ph'),
  ('GALAN, RAFFY S.', 'Associate Professor III', 'COC', 'raffy.galan@wvsu.edu.ph'),
  ('GALANZA, CYRIL JOHN M.', 'Assistant Professor II', 'COP', 'cyriljohn.galanza@wvsu.edu.ph'),
  ('GALENO, PEDRO JR. P.', 'Instructor III', 'CAS', 'pedro.galeno@wvsu.edu.ph'),
  ('GAMBA, CHRISTINE P.', 'Associate Professor I', 'CBM', 'christine.gamba@wvsu.edu.ph'),
  ('GARCIA, DONILLE G.', 'Assistant Professor I', 'COD', 'donille.garcia@wvsu.edu.ph'),
  ('GARCIA, JEMUEL JR., B.', 'Assistant Professor III', 'COP', 'jemuel.garciajr@wvsu.edu.ph'),
  ('GARDOSE, CEASAR P.', 'Associate Professor II', 'COM', 'ceasar.gardose@wvsu.edu.ph'),
  ('GAVERZA, BONIFACIO P.', 'Instructor III', 'COE', 'bonifacio.gaverza@wvsu.edu.ph'),
  ('GAZO, SHENLY MARIE T.', 'Instructor III', 'CAS', 'smgazo@wvsu.edu.ph'),
  ('GELLADA, CELINA C.', 'Professor I', 'COM', 'celina_gelladamd@wvsu.edu.ph'),
  ('GELLANGARIN, JOHN ALVIN B.', 'Assistant Professor II', 'COM', 'jgellangarin@wvsu.edu.ph'),
  ('GEMINO, JOHN ALEXIS B.', 'Instructor III', 'CAS', 'johnalexis.gemino@wvsu.edu.ph'),
  ('GERASMO, AGNES SEGUNDA F.', 'Assistant Professor IV', 'COM', 'asgerasmo@wvsu.edu.ph'),
  ('GERONA, BERNARD V.', 'Instructor III', 'CAS', 'bernard.gerona@wvsu.edu.ph'),
  ('GIDAYA, KRISTOFFER RYAN T.', 'Associate Professor IV', 'CAS', 'krgidaya@wvsu.edu.ph'),
  ('GLORIAL, JONATHAN C.', 'Associate Professor V', 'COE', 'jonathan.glorial@wvsu.edu.ph'),
  ('GOLEZ, AMOUR C.', 'Assistant Professor I', 'CON', 'amour.golez@wvsu.edu.ph'),
  ('GOMEZ, EDELYN P.', 'Assistant Professor II', 'CAS', 'edelyn.gomez@wvsu.edu.ph'),
  ('GOMEZ, RAYMUND NIÑO Z.', 'Assistant Professor II', 'COM', 'raymund.gomez@wvsu.edu.ph'),
  ('GORRICETA, WILLAH D.', 'Assistant Professor II', 'CON', 'w_gorriceta@wvsu.edu.ph'),
  ('GRECIA, GLENN JR., L.', 'Assistant Professor II', 'COM', 'glenn.grecia@wvsu.edu.ph'),
  ('GREY, EVELYN J.', 'Professor VI', 'CAS', 'egrey@wvsu.edu.ph'),
  ('GUARTILLA, MIA S.', 'Instructor III', 'CBM', 'mia.guartilla@wvsu.edu.ph'),
  ('GUILLEN, LOREN MAE C.', 'Instructor III', 'CAS', 'lorenmae.guillen@wvsu.edu.ph'),
  ('GUSTILO, CARLA P.', 'Assistant Professor III', 'CON', 'carla.gustilo@wvsu.edu.ph'),
  ('GUSTILO, EVA MARIE V.', 'Assistant Professor I', 'COD', 'evamarie.gustilo@wvsu.edu.ph'),
  ('GUSTILO, REGINA JOHANNA V.', 'Assistant Professor II', 'COL', 'reginajohanna.gustilo@wvsu.edu.ph'),
  ('HABANA, MAYLIN P.', 'Associate Professor I', 'CON', 'mhabana@wvsu.edu.ph'),
  ('HARADJI, FATIMA RHADA D.', 'Assistant Professor I', 'CON', 'fatimarhada.haradji@wvsu.edu.ph'),
  ('HERMANO, REYGEI B.', 'Assistant Professor II', 'CAS', 'reygei.hermano@wvsu.edu.ph'),
  ('HERRERA, RENATO JR., V.', 'Instructor III', 'COE', 'r_herrerajr@wvsu.edu.ph'),
  ('HOJILLA, MA. ELENA BERNADETTE P.', 'Associate Professor V', 'COE', 'mebhojilla@wvsu.edu.ph'),
  ('HORTILLOSA, CARLA MAY L.', 'Assistant Professor I', 'COD', 'carlamay.hortillosa@wvsu.edu.ph'),
  ('HORTILLOSA, JOECAR T.', 'Assistant Professor I', 'CON', 'joecar.hortillosa@wvsu.edu.ph'),
  ('INESORIA, ANGELIE II G.', 'Instructor III', 'UDE', 'angelie.inesoria@wvsu.edu.ph'),
  ('INOCENCIO, ARIZZA JULIA A.', 'Instructor III', 'CAS', 'arizza.inocencio@wvsu.edu.ph'),
  ('JABADAN, JOSEL S.', 'Assistant Professor II', 'COM', 'josel.jabadan@wvsu.edu.ph'),
  ('JACELA, RICHEL G.', 'Instructor III', 'CBM', 'richel.jacela@wvsu.edu.ph'),
  ('JACINTO, VOLTAIRE B.', 'Associate Professor III', 'CAS', 'vjacinto@wvsu.edu.ph'),
  ('JAEN, ANJULI MAY P.', 'Assistant Professor II', 'COM', 'anjuli.mayjaen@wvsu.edu.ph'),
  ('JAEN, GERALD ANTHONY A.', 'Instructor III', 'CAS', 'gerald.jaen@wvsu.edu.ph'),
  ('JAMERO, ELEANOR S.', 'Associate Professor V', 'COE', 'e_jamero@wvsu.edu.ph'),
  ('JANAY, VERNA JADE B.', 'Professor II', 'COE', 'jade.janay@wvsu.edu.ph'),
  ('JASPE, CHRISTOPHER T.', 'Associate Professor V', 'COP', 'christopher.jaspe@wvsu.edu.ph'),
  ('JAVA, ROSEMARIE M.', 'Assistant Professor IV', 'CAS', 'rosemarie.java@wvsu.edu.ph'),
  ('JAVIER, IZANOR LYN M.', 'Assistant Professor I', 'CON', 'izanorlyn.javier@wvsu.edu.ph'),
  ('JOVER, LIZA ASSUMPTA M.', 'Associate Professor I', 'COD', 'liza.jover@wvsu.edu.ph'),
  ('JUMERAS, ANALYN G.', 'Assistant Professor II', 'COM', 'analyn.jumeras@wvsu.edu.ph'),
  ('JUNGGAY, PAUL IAN T.', 'Instructor III', 'COE', 'paul.junggay@wvsu.edu.ph'),
  ('KILAYKO, GENEVIEVE H.', 'Assistant Professor I', 'CON', 'genevieve.kilayko@wvsu.edu.ph'),
  ('LABIS, SYBEL JOY F.', 'Associate Professor V', 'COE', 'sj_labis@wvsu.edu.ph'),
  ('LABURADA, FRANCES LOUIE Q.', 'Instructor III', 'CAS', 'francaeslouie.laburada@wvsu.edu.ph'),
  ('LACHICA, GENEVEVE P.', 'Associate Professor V', 'CAS', 'gmparreno@wvsu.edu.ph'),
  ('LACHICA, LOUIS PLACIDO F.', 'Associate Professor V', 'COC', 'louis.lachica@wvsu.edu.ph'),
  ('LADUBLAN, JOHN R.', 'Associate Professor I', 'COE', 'john.ladublan@wvsu.edu.ph'),
  ('LAÑADA, JONEL P.', 'Professor III', 'CAS', 'jonel.lanada@wvsu.edu.ph'),
  ('LAPIDANTE, FEBRAY G.', 'Assistant Professor I', 'CON', 'febray.lapidante@wvsu.edu.ph'),
  ('LARIGA, VERNA MAE A.', 'Assistant Professor III', 'CBM', 'vmlariga@wvsu.edu.ph'),
  ('LARRODER, ARIS C.', 'Associate Professor V', 'CAS', 'aris.larroder@wvsu.edu.ph'),
  ('LASPINAS, RHODA MAE G.', 'Assistant Professor I', 'CON', 'rhodamae.laspinas@wvsu.edu.ph'),
  ('LATAP, RONALD R.', 'Assistant Professor II', 'COM', 'ronald.latap@wvsu.edu.ph'),
  ('LEDESMA, LILY C.', 'Assistant Professor II', 'CON', 'lily.caliao@wvsu.edu.ph'),
  ('LEDESMA, RUS WILL E.', 'Instructor III', 'COP', 'ruswill.ledesma@wvsu.edu.ph'),
  ('LEGO, REIDO H.', 'Assistant Professor I', 'CON', 'reido.lego@wvsu.edu.ph'),
  ('LENAUGO, JOGIE MARIE C.', 'Instructor III', 'CAS', 'jogiemarie.lenaugo@wvsu.edu.ph'),
  ('LENTIJA, NOEL P.', 'Assistant Professor I', 'CAS', 'noel.lentija@wvsu.edu.ph'),
  ('LIGUE, DITAS L.', 'Associate Professor IV', 'COE', 'ditas.ligue@wvsu.edu.ph'),
  ('LIMSIACO, CYNTHIA L.', 'Associate Professor V', 'CAS', 'cynthia.limsiaco@wvsu.edu.ph'),
  ('LOMIGO, LIZA MARIE R.', 'Assistant Professor II', 'COM', 'lizamarie.lomigo@wvsu.edu.ph'),
  ('LOSAÑES, MANUELA R.', 'Instructor III', 'CICT', 'm_losanes@wvsu.edu.ph'),
  ('MACAPAR, JOHAN S.', 'Assistant Professor II', 'CON', 'johanmacapar@wvsu.edu.ph'),
  ('MADRESTA, TRACY MARIE ANDREA', 'Instructor III', 'CICT', 'tracymarieandrea.madresta@wvsu.edu.ph'),
  ('MAGDAUG, ROBERT L.', 'Associate Professor II', 'CAS', 'robert.magdaug@wvsu.edu.ph'),
  ('MAGNO, RICKY M.', 'Associate Professor V', 'COE', 'rickymagno@wvsu.edu.ph'),
  ('MALATA, MA. PILAR CHARMAINE S.', 'Associate Professor V', 'COM', 'pilar.malata@wvsu.edu.ph'),
  ('MALAYA, MICHAELA MARIE D.', 'Instructor III', 'CAS', 'michaelamarie.malaya@wvsu.edu.ph'),
  ('MALHABOUR, ALYSSA MARIE D.', 'Instructor III', 'CAS', 'alyssamarie.malhabour@wvsu.edu.ph'),
  ('MALIAO, BERNICE P.', 'Associate Professor I', 'CAS', 'bmaliao@wvsu.edu.ph'),
  ('MALLORCA, KEITH LESTER A.', 'Instructor III', 'CAS', 'klmallorca@wvsu.edu.ph'),
  ('MALONES, EVA ROSE G.', 'Associate Professor III', 'COP', 'emalones@wvsu.edu.ph'),
  ('MANAJERO, GRACE A.', 'Associate Professor V', 'CAS', 'grace.manajero@wvsu.edu.ph'),
  ('MARAVILLA, CLAR J V.', 'Assistant Professor II', 'COM', 'cmaravilla@wvsu.edu.ph'),
  ('MAROMA, JOSE III S.', 'Assistant Professor I', 'COD', 'jose.maroma@wvsu.edu.ph'),
  ('MARTINEZ, MA. EMIDA A.', 'Assistant Professor II', 'CON', 'memartinez@wvsu.edu.ph'),
  ('MATEO, JOHN CRISTOPHER A.', 'Instructor III', 'CICT', 'johncristopher.mateo@wvsu.edu.ph'),
  ('MAYBAY, JOEVANNE B.', 'Assistant Professor II', 'COM', 'joevanne.maybay@wvsu.edu.ph'),
  ('MENDOZA, MA. VERONICA S.', 'Assistant Professor III', 'COE', 'mvmendoza@wvsu.edu.ph'),
  ('MENDOZA, ROUMILLA B.', 'Associate Professor IV', 'COM', 'roumillamendoza@wvsu.edu.ph'),
  ('MENDOZA, SHARON ANN P.', 'Assistant Professor IV', 'COE', 'sharon.mendoza@wvsu.edu.ph'),
  ('MILLAMA, GILLEA V.', 'Instructor I', 'COE', 'gillea.millama@wvsu.edu.ph'),
  ('MINERVA-SORIANO, IVY JUNE T.', 'Assistant Professor II', 'COM', 'ivyjune.soriano@wvsu.edu.ph'),
  ('MIRAL, KAREN LORIE C.', 'Instructor III', 'CAS', 'karenlorie.miral@wvsu.edu.ph'),
  ('MONARCA, ANGEL JR. G.', 'Assistant Professor I', 'CON', 'angel.monarca@wvsu.edu.ph'),
  ('MONDEJAR, NOEL P.', 'Associate Professor III', 'COP', 'nmondejar@wvsu.edu.ph'),
  ('MONSALUD, ROSSINI G.', 'Associate Professor III', 'COE', 'rossini.monsalud@wvsu.edu.ph'),
  ('MONTANO, HILDA C.', 'Professor VI', 'COE', 'hildamontano@wvsu.edu.ph'),
  ('MONTERO, SHEILA ANN Y.', 'Instructor III', 'COP', 'sheilaann.montero@wvsu.edu.ph'),
  ('MORENO, FRANCIS DAVE C.', 'Assistant Professor IV', 'COP', 'francisdave.moreno@wvsu.edu.ph'),
  ('MORENO, MYLA JANE D.', 'Instructor III', 'COE', 'mj.moreno@wvsu.edu.ph'),
  ('MORENO, RUTHELL A.', 'Instructor III', 'COE', 'ruthell.moreno@wvsu.edu.ph'),
  ('MORGA, CYNTHIA L.', 'Associate Professor V', 'CAS', 'cynthiamorga@wvsu.edu.ph'),
  ('MURILLO, JUAN MIGUEL L.', 'Assistant Professor II', 'COM', 'juanmiguel.murillo@wvsu.edu.ph'),
  ('NEJAR, JULIE C.', 'Assistant Professor II', 'CBM', 'julie.nejar@wvsu.edu.ph'),
  ('NERPIOL, GLADYS N.', 'Assistant Professor II', 'COM', 'gladys.nerpiol@wvsu.edu.ph'),
  ('NOGRA, MARK VINCENT J.', 'Instructor III', 'CAS', 'markvincent.nogra@wvsu.edu.ph'),
  ('NULLAGA, RYZEL S.', 'Instructor I', 'COE', 'ryzel.nullaga@wvsu.edu.ph'),
  ('NUNEZ, KIM P.', 'Instructor III', 'CAS', 'kim.nunez@wvsu.edu.ph'),
  ('OBERIO, DENNIS C.', 'Assistant Professor I', 'CBM', 'dennis.oberio@wvsu.edu.ph'),
  ('ODIO, RYAN J.', 'Associate Professor V', 'CAS', 'ryan.odio@wvsu.edu.ph'),
  ('ODUCADO, RYAN MICHAEL F.', 'Professor VI', 'CON', 'rmoducado@wvsu.edu.ph'),
  ('OLAC, RAY JR., V.', 'Assistant Professor II', 'COM', 'ray.olac@wvsu.edu.ph'),
  ('OLIVEROS, MYRA ANGELIE D.', 'Associate Professor III', 'COE', 'myraangelie.oliveros@wvsu.edu.ph'),
  ('ONG, MARRISSA O.', 'Assistant Professor III', 'COE', 'marrissaong@wvsu.edu.ph'),
  ('OSORIO, ERWIN D.', 'Associate Professor I', 'CICT', 'erwin.osorio@wvsu.edu.ph'),
  ('PABILONA, JOANNA C.', 'Associate Professor I', 'CON', 'joanna.pabilona@wvsu.edu.ph'),
  ('PACARDO, MELGIE G.', 'Instructor III', 'CICT', 'melgie.pacardo@wvsu.edu.ph'),
  ('PACLIBAR, MARIA RENA D.', 'Assistant Professor II', 'COM', 'rena.paclibar@wvsu.edu.ph'),
  ('PACLIBAR, WEENA M.', 'Associate Professor II', 'COP', 'wpaclibar@wvsu.edu.ph'),
  ('PADILLA, SIMOUN OMAR DYLAN B.', 'Instructor III', 'CAS', 'simounomardylan.padilla@wvsu.edu.ph'),
  ('PAGENTE, CRISTY R.', 'Associate Professor III', 'CBM', 'cristy.pagente@wvsu.edu.ph'),
  ('PAGUNSAN, SHARON FAITH B.', 'Assistant Professor II', 'COM', 'sharonfaith.pagunsan@wvsu.edu.ph'),
  ('PAJURA, JENNET F.', 'Instructor III', 'COE', 'jennet.pajura@wvsu.edu.ph'),
  ('PALINES, MA. JALEN R.', 'Instructor III', 'CBM', 'majalen.palines@wvsu.edu.ph'),
  ('PALMA, BONNA S.', 'Professor VI', 'CAS', 'bpalma@wvsu.edu.ph'),
  ('PALMARES, CHRISTOPHER T.', 'Assistant Professor I', 'CON', 'christopher.palmares@wvsu.edu.ph'),
  ('PALMES, MA. DEB B.', 'Assistant Professor II', 'COM', 'ma.palmes@wvsu.edu.ph'),
  ('PALMES, MADONNA S.', 'Associate Professor III', 'CON', 'madonna.palmes@wvsu.edu.ph'),
  ('PALMOS, REJIE F.', 'Associate Professor V', 'COE', 'rpalmos@wvsu.edu.ph'),
  ('PAMONAG, PAULETTE MARIE B.', 'Assistant Professor I', 'COD', 'paulette.pamonag@wvsu.edu.ph'),
  ('PANTINO, FRANCIS O.', 'Associate Professor V', 'CAS', 'fpantino@wvsu.edu.ph'),
  ('PANTINO, JOY H.', 'Associate Professor I', 'CAS', 'joy.pantino@wvsu.edu.ph'),
  ('PARIS, LERMA D.', 'Assistant Professor II', 'COM', 'lerma.paris@wvsu.edu.ph'),
  ('PARIS, PETER ERNIE D.', 'Associate Professor V', 'COE', 'peterernie.paris@wvsu.edu.ph'),
  ('PARREÑO, DANILO M.', 'Associate Professor III', 'COE', 'danilo.parreno@wvsu.edu.ph'),
  ('PAULINO, GLEA JOY E.', 'Instructor III', 'COP', 'gleajoy.paulino@wvsu.edu.ph'),
  ('PEDROSO, JOHN ERWIN P.', 'Associate Professor V', 'COE', 'johnerwin.pedroso@wvsu.edu.ph'),
  ('PEÑARANDA, BRIDITH S.', 'Assistant Professor II', 'COM', 'bridith.penaranda@wvsu.edu.ph'),
  ('PENECILLA, GERARD LORENZ M.', 'Assistant Professor II', 'COM', 'gerardlorenz.penecilla@wvsu.edu.ph'),
  ('PENIERO, MARICEL B.', 'Assistant Professor II', 'COM', 'maricel.peniero@wvsu.edu.ph'),
  ('PENUELA, AYESHA C.', 'Associate Professor IV', 'CON', 'acpenuela@wvsu.edu.ph'),
  ('PENUELA, ROCKY L.', 'Assistant Professor I', 'COP', 'rpenuela@wvsu.edu.ph'),
  ('PERALTA, FERNAND D.', 'Assistant Professor III', 'CAS', 'f_peralta@wvsu.edu.ph'),
  ('PEREZ, MA. GRACE G.', 'Assistant Professor II', 'COM', 'magrace.perez@wvsu.edu.ph'),
  ('PESTAÑO, LARRY H.', 'Assistant Professor II', 'COL', 'larry.pestano@wvsu.edu.ph'),
  ('PIDO, ROSALIE G.', 'Associate Professor V', 'CAS', 'rosalie.pido@wvsu.edu.ph'),
  ('PINEDA, MARY JUNE D.', 'Associate Professor V', 'COE', 'maryjune.pineda@wvsu.edu.ph'),
  ('PLANTIG, MYRNA G.', 'Instructor III', 'CBM', 'myrna.plantig@wvsu.edu.ph'),
  ('PORRAS, IVONY S.', 'Assistant Professor I', 'CON', 'ivony.porras@wvsu.edu.ph'),
  ('PORRAS, LIBERTY R.', 'Associate Professor V', 'COP', 'liberty.porras@wvsu.edu.ph'),
  ('PRIO, HENRY JOHN M.', 'Instructor III', 'CAS', 'henryjohn.prio@wvsu.edu.ph'),
  ('PULJANAN, RYAN L.', 'Associate Professor II', 'COP', 'ryan.puljanan@wvsu.edu.ph'),
  ('QUERO, SHIELA MAE C.', 'Associate Professor V', 'COC', 'smecquero@wvsu.edu.ph'),
  ('QUIDATO, JULIE GAY B.', 'Associate Professor V', 'COE', 'juliegay.quidato@wvsu.edu.ph'),
  ('QUIMPO, CAROL JOY T.', 'Assistant Professor IV', 'COM', 'carol.quimpo@wvsu.edu.ph'),
  ('QUIMPO, DAVID ARTHUR M.', 'Assistant Professor IV', 'COC', 'darm.quimpo@wvsu.edu.ph'),
  ('RABORAR, NEILJAN C.', 'Instructor III', 'CICT', 'nraborar@wvsu.edu.ph'),
  ('RAFOLS, RIZA CHARITY JUNE D.', 'Assistant Professor III', 'COC', 'rcjrafols@wvsu.edu.ph'),
  ('RAMIREZ, LIZA MARIE M.', 'Associate Professor III', 'CON', 'lmramirez@wvsu.edu.ph'),
  ('RAYMUNDO, NICHOL JOHN J.', 'Instructor III', 'CBM', 'nichol.john.raymundo@wvsu.edu.ph'),
  ('REFRE, GLENFORD R.', 'Assistant Professor II', 'COM', 'glenford.refre@wvsu.edu.ph'),
  ('RENDAJE, AJ KHANER A.', 'Assistant Professor I', 'CON', 'ajkhaner.rendaje@wvsu.edu.ph'),
  ('REYES, ANTONIO III S.', 'Assistant Professor II', 'COM', 'antonio.reyes@wvsu.edu.ph'),
  ('REYES, CRESANIE P.', 'Assistant Professor II', 'COM', 'cresanie.puig-reyes@wvsu.edu.ph'),
  ('RICO, JULYNN J.', 'Assistant Professor IV', 'COE', 'julynne.rico@wvsu.edu.ph'),
  ('RIVERA, HELEN JOY L.', 'Associate Professor II', 'COE', 'helenjoy.rivera@wvsu.edu.ph'),
  ('ROBITE, EMILY E.', 'Associate Professor III', 'CON', 'ems.robite@wvsu.edu.ph'),
  ('ROBLES, BABY ROSE G.', 'Associate Professor V', 'COE', 'brrobles@wvsu.edu.ph'),
  ('RODULFA, GERLIE JOY P.', 'Instructor III', 'COE', 'gerlie.rodulfa@wvsu.edu.ph'),
  ('ROLLE, MAY GRACE N.', 'Assistant Professor II', 'COM', 'maygrace.rolle@wvsu.edu.ph'),
  ('ROQUIOS, JEVAN VEN N.', 'Assistant Professor I', 'CON', 'jevan.roquios@wvsu.edu.ph'),
  ('ROSANO, DAISY A.', 'Associate Professor V', 'COE', 'drosano@wvsu.edu.ph'),
  ('RUFON, GREGORIO ANASTACIO JR. S.', 'Associate Professor II', 'COM', 'garufon@wvsu.edu.ph'),
  ('RUTE, FRANCES GERALDINE B.', 'Assistant Professor I', 'CON', 'francesgeraldine.rute@wvsu.edu.ph'),
  ('SABARILLO, CHARRIZ A.', 'Instructor III', 'CAS', 'charriz.sabarillo@wvsu.edu.ph'),
  ('SABAYLE, MA. LUCHE P.', 'Associate Professor III', 'CICT', 'mlsabayle@wvsu.edu.ph'),
  ('SABINAY, STEPHEN G.', 'Associate Professor V', 'CAS', 'ssabinay@wvsu.edu.ph'),
  ('SABIO, HAZEL S.', 'Assistant Professor IV', 'CBM', 'hazel.sabio@wvsu.edu.ph'),
  ('SACAPAÑO, LENLEN D.', 'Assistant Professor II', 'CAS', 'lenlen.sacapano@wvsu.edu.ph'),
  ('SACLAUSO, CIARA ANNE MARIE B.', 'Assistant Professor I', 'COD', 'ciaraanne.saclauso@wvsu.edu.ph'),
  ('SAGGE, ROBERTO JR., G.', 'Associate Professor V', 'COE', 'robertosagge@wvsu.edu.ph'),
  ('SALADAR, EDEN L.', 'Assistant Professor IV', 'COM', 'eden.saladar@wvsu.edu.ph'),
  ('SALAZAR, MA. IRIS V.', 'Assistant Professor II', 'COM', 'mairis.salazar@wvsu.edu.ph'),
  ('SALCEDO, MA. CARMEN S.', 'Assistant Professor II', 'COM', 'ma.carmen.salcedo@wvsu.edu.ph'),
  ('SALDAÑA, MARIE CHRISTIE HYACINTH A.', 'Instructor III', 'COP', 'mariech.saldana@wvsu.edu.ph'),
  ('SALEM, CRISELDA S.', 'Assistant Professor I', 'CON', 'criselda.salem@wvsu.edu.ph'),
  ('SALISTRE, ARLYN F.', 'Assistant Professor IV', 'CON', 'afsalistre@wvsu.edu.ph'),
  ('SAMILO, PEARLY JADE E.', 'Associate Professor V', 'COE', 'pearlyjade.embajador@wvsu.edu.ph'),
  ('SAMORIN, MARIA CORAZON M.', 'Associate Professor V', 'CBM', 'mariacorazon.samorin@wvsu.edu.ph'),
  ('SANDICO, IFFERLYN JOY L.', 'Instructor III', 'CAS', 'ifferlynjoy.sandico@wvsu.edu.ph'),
  ('SANDIG, SHEM DURST ELIJAH B.', 'Instructor III', 'CICT', 'sdesandig@wvsu.edu.ph'),
  ('SECHERITA, ANA MAE A.', 'Assistant Professor I', 'CON', 'anamae.secherita@wvsu.edu.ph'),
  ('SECONDES, ARNEL N.', 'Associate Professor V', 'CICT', 'arnel.secondes@wvsu.edu.ph'),
  ('SERMONIA, EUNICE V.', 'Assistant Professor III', 'COM', 'eunice.sermonia@wvsu.edu.ph'),
  ('SEVILLENA, CAMILLE ARYNE S.', 'Instructor III', 'CICT', 'camillearyne.sevillena@wvsu.edu.ph'),
  ('SIASON, AMABEL T.', 'Associate Professor V', 'COE', 'atsiason@wvsu.edu.ph'),
  ('SIMBRAN, ANGELICA GRACE P.', 'Instructor III', 'CICT', 'angelicagrace.simbran@wvsu.edu.ph'),
  ('SIMPAS, JEANETTE J.', 'Associate Professor V', 'CAS', 'jeanette.simpas@wvsu.edu.ph'),
  ('SIOSON, DONABELLE R.', 'Assistant Professor I', 'CON', 'donabelle.sioson@wvsu.edu.ph'),
  ('SOBREVEGA, SATURNINO LUKE A.', 'Instructor III', 'CAS', 'slsobrevega@wvsu.edu.ph'),
  ('SOLDEVILLA, HELMAR F.', 'Associate Professor I', 'COM', 'helmar.soldevilla@wvsu.edu.ph'),
  ('SOLIDARIOS, MARK JOSEPH J.', 'Instructor III', 'CICT', 'markjoseph.solidarios@wvsu.edu.ph'),
  ('SOLIVIO, MORWENA JANE V.', 'Professor I', 'CAS', 'morwenajane.solivio@wvsu.edu.ph'),
  ('SOLMAYOR, APRIEL GRACE S.', 'Instructor III', 'CAS', 'aprielgrace.solmayor@wvsu.edu.ph'),
  ('SOLOMON, FRANZ IAN D.', 'Instructor III', 'COE', 'franzian.solomon@wvsu.edu.ph'),
  ('SOMBITO, CHARISSE ARIANE P.', 'Assistant Professor I', 'CON', 'charisseariane.sombito@wvsu.edu.ph'),
  ('SORIA, MARIA LUZ JOANNA B.', 'Assistant Professor II', 'COM', 'marialuz.soria@wvsu.edu.ph'),
  ('SOURIBIO, ARTURO S.', 'Associate Professor V', 'COE', 'asouribio@wvsu.edu.ph'),
  ('SUBONG-CSOKA, EDEL CARMELA S.', 'Instructor III', 'COC', 'edelsubong-csoka@wvsu.edu.ph'),
  ('SUDARIO, MA. EVERLY N.', 'Associate Professor V', 'CBM', 'maeverly.sudario@wvsu.edu.ph'),
  ('SUMAGAYSAY, IAN VAN V.', 'Assistant Professor II', 'CON', 'ivsumagaysay@wvsu.edu.ph'),
  ('SUMIDO, EVAN C.', 'Assistant Professor III', 'CICT', 'evan_sumido@wvsu.edu.ph'),
  ('SURMIEDA, NANCY S.', 'Professor IV', 'CAS', 'nsurmieda@wvsu.edu.ph'),
  ('SY, TOMASITO R.', 'Assistant Professor IV', 'COM', 'tomasito.sy@wvsu.edu.ph'),
  ('TACORDA, FEBRAH MAE P.', 'Instructor III', 'COP', 'febrahmae.tacorda@wvsu.edu.ph'),
  ('TAJURES, JOSHUA T.', 'Instructor III', 'CAS', 'joshua.tajures@wvsu.edu.ph'),
  ('TANALEON, LOREY F.', 'Associate Professor V', 'COE', 'l_tanaleon@wvsu.edu.ph'),
  ('TANGUB, VIJAY', 'Instructor III', 'CICT', 'vtangub@wvsu.edu.ph'),
  ('TANTIADO, REY G.', 'Associate Professor V', 'CAS', 'rtantiado@wvsu.edu.ph'),
  ('TEMELO, DOLLY ROSE F.', 'Associate Professor V', 'CAS', 'dollyrose.temelo@wvsu.edu.ph'),
  ('TINGSON, LEA C.', 'Associate Professor I', 'COE', 'l_tingson@wvsu.edu.ph'),
  ('TORRICO, LAVIE MAE R.', 'Instructor III', 'CAS', 'laviemay.torrico@wvsu.edu.ph'),
  ('TRAGICO, GIFT D.', 'Instructor III', 'COE', 'gift.tragico@wvsu.edu.ph'),
  ('TRIBUNAL, MA. JESTINE B.', 'Instructor III', 'CBM', 'majestine.tribunal@wvsu.edu.ph'),
  ('TUBAL, MICHAEL CAESAR C.', 'Associate Professor II', 'COE', 'michaelcaesar.tubal@wvsu.edu.ph'),
  ('TUSIAP, ANDREA L.', 'Instructor III', 'CAS', 'andrea.tusiap@wvsu.edu.ph'),
  ('TUVILLO, RICHELLE O.', 'Associate Professor III', 'CAS', 'rtuvillo@wvsu.edu.ph'),
  ('UDANI, MA. CHRISTINE C.', 'Assistant Professor I', 'CON', 'machristine.udani@wvsu.edu.ph'),
  ('VALENCIA, EMMYLOU JANE B.', 'Assistant Professor II', 'COM', 'emmyloujane.valencia@wvsu.edu.ph'),
  ('VEGA, SHEILA MARIE G.', 'Assistant Professor IV', 'CBM', 'sheila.vega@wvsu.edu.ph'),
  ('VILLA, HAZEL P.', 'Associate Professor V', 'COE', 'hpvilla@wvsu.edu.ph'),
  ('VILLANUEVA, ANGEL COLEEN F.', 'Instructor III', 'COE', 'angelcoleen.villanueva@wvsu.edu.ph'),
  ('VILLANUEVA, JUNAH C.', 'Assistant Professor IV', 'CON', 'junah.villanueva@wvsu.edu.ph'),
  ('VILLANUEVA, ROBERTO P.', 'Associate Professor III', 'COM', 'roberto.villanueva@wvsu.edu.ph'),
  ('VILLARINO, MAUREEN LORENCE F.', 'Assistant Professor I', 'CON', 'maureenlorence.villarino@wvsu.edu.ph'),
  ('VILLARINO, RESTI TITO H.', 'Assistant Professor I', 'CON', 'restitito.villarino@wvsu.edu.ph'),
  ('VILLARUZ, JENNIFER A.', 'Instructor III', 'CAS', 'jennifer.villaruz@wvsu.edu.ph'),
  ('VIOLETA, MARIEVIC M.', 'Associate Professor V', 'COE', 'marievic.violeta@wvsu.edu.ph'),
  ('VITO, FEANNA B.', 'Instructor III', 'CBM', 'feanna.vito@wvsu.edu.ph'),
  ('YERRO, PRENCY D.', 'Associate Professor III', 'CAS', 'p_yerro@wvsu.edu.ph'),
  ('YORO, JENY ROSE L.', 'Assistant Professor I', 'CON', 'jenyrose.yoro@wvsu.edu.ph'),
  ('ZOLINA, MERLYN F.', 'Associate Professor I', 'COE', 'merlyn.zolina@wvsu.edu.ph');

-- Validate all 406 rows before updating the permanent faculty table.
DO $$
DECLARE
  staged_count integer;
BEGIN
  SELECT COUNT(*)
  INTO staged_count
  FROM public._wayfinder_faculty_import_stage;

  IF staged_count <> 406 THEN
    RAISE EXCEPTION
      'Expected 406 faculty rows; found %.', staged_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public._wayfinder_faculty_import_stage
    GROUP BY lower(btrim(full_name))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate faculty names found in staging data.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public._wayfinder_faculty_import_stage
    GROUP BY lower(btrim(official_email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate official email addresses found in staging data.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public._wayfinder_faculty_import_stage
    WHERE btrim(full_name) = ''
       OR btrim(position_title) = ''
       OR btrim(official_email) = ''
       OR official_email !~* '^[^@[:space:]]+@wvsu[.]edu[.]ph$'
  ) THEN
    RAISE EXCEPTION
      'A faculty name, position title, or WVSU email address is invalid.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public._wayfinder_faculty_import_stage AS s
    LEFT JOIN public.places AS p
      ON p.id = s.college_code
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'A faculty college code does not have a matching public.places record.';
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 5. Update existing rows by reviewed full name.
--    This also refreshes records created by the earlier draft import.
-- ----------------------------------------------------------------------------
UPDATE public.faculty AS f
SET
  full_name = s.full_name,
  position_title = s.position_title,
  college_id = s.college_code,
  office_id = NULL,
  official_email = s.official_email,
  office_hours = 'Monday–Friday, 8:00 AM–5:00 PM (general university service hours; no noon break; faculty consultation schedules may vary)',
  status = 'verified',
  source = 'WVSU Human Resources',
  verified_by = 'WayFinder Team',
  verified_at = now()
FROM public._wayfinder_faculty_import_stage AS s
WHERE lower(btrim(f.full_name)) = lower(btrim(s.full_name));

-- ----------------------------------------------------------------------------
-- 6. Update any remaining existing rows matched by official email.
-- ----------------------------------------------------------------------------
UPDATE public.faculty AS f
SET
  full_name = s.full_name,
  position_title = s.position_title,
  college_id = s.college_code,
  office_id = NULL,
  official_email = s.official_email,
  office_hours = 'Monday–Friday, 8:00 AM–5:00 PM (general university service hours; no noon break; faculty consultation schedules may vary)',
  status = 'verified',
  source = 'WVSU Human Resources',
  verified_by = 'WayFinder Team',
  verified_at = now()
FROM public._wayfinder_faculty_import_stage AS s
WHERE lower(btrim(f.official_email)) = lower(btrim(s.official_email));

-- ----------------------------------------------------------------------------
-- 7. Insert only records that do not already exist by name or official email.
-- ----------------------------------------------------------------------------
INSERT INTO public.faculty (
  full_name,
  position_title,
  college_id,
  office_id,
  official_email,
  office_hours,
  status,
  source,
  verified_by,
  verified_at
)
SELECT
  s.full_name,
  s.position_title,
  s.college_code,
  NULL,
  s.official_email,
  'Monday–Friday, 8:00 AM–5:00 PM (general university service hours; no noon break; faculty consultation schedules may vary)',
  'verified',
  'WVSU Human Resources',
  'WayFinder Team',
  now()
FROM public._wayfinder_faculty_import_stage AS s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.faculty AS f
  WHERE lower(btrim(f.full_name)) = lower(btrim(s.full_name))
     OR lower(btrim(f.official_email)) = lower(btrim(s.official_email))
);

-- ----------------------------------------------------------------------------
-- 8. Confirm all staged records now exist with the intended reviewed values.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  matched_count integer;
BEGIN
  SELECT COUNT(*)
  INTO matched_count
  FROM public._wayfinder_faculty_import_stage AS s
  JOIN public.faculty AS f
    ON lower(btrim(f.full_name)) = lower(btrim(s.full_name))
   AND lower(btrim(f.official_email)) = lower(btrim(s.official_email))
   AND f.position_title = s.position_title
   AND f.college_id = s.college_code
   AND f.status = 'verified'
   AND f.source = 'WVSU Human Resources'
   AND f.verified_by = 'WayFinder Team'
   AND f.verified_at IS NOT NULL;

  IF matched_count <> 406 THEN
    RAISE EXCEPTION
      'Import verification failed: expected 406 matching faculty records, found %.',
      matched_count;
  END IF;
END
$$;

-- Ensure the student-facing API can read position_title.
-- The existing RLS policy should continue restricting public reads to verified rows.
GRANT SELECT (
  id,
  full_name,
  position_title,
  college_id,
  office_id,
  official_email,
  office_hours,
  verified_at
) ON public.faculty TO anon, authenticated;

-- Final transaction-local verification summary.
SELECT
  COUNT(*) AS imported_faculty_records,
  COUNT(*) FILTER (WHERE status = 'verified') AS verified_records,
  COUNT(DISTINCT college_id) AS represented_colleges_or_units,
  COUNT(*) FILTER (WHERE f.official_email ~* '^[^@[:space:]]+@wvsu[.]edu[.]ph$')
    AS valid_wvsu_email_records
FROM public.faculty AS f
JOIN public._wayfinder_faculty_import_stage AS s
  ON lower(btrim(f.full_name)) = lower(btrim(s.full_name))
 AND lower(btrim(f.official_email)) = lower(btrim(s.official_email));

-- Remove the locked-down staging table after a successful import.
DROP TABLE public._wayfinder_faculty_import_stage;

COMMIT;

-- Expected verification result:
-- imported_faculty_records = 406
-- verified_records = 406
-- represented_colleges_or_units = 11
-- valid_wvsu_email_records = 406