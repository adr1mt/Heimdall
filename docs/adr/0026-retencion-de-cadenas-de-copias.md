# ADR-0026 · Retención de cadenas completas de copias

Estado: aceptada · Fecha: 2026-10-02

R04 demostró que conservar solo 50 ficheros rompe un reintento reciente cuando
su antecedente es antiguo. Se mantiene la copia automática de notas sin salidas
y la restauración que no sobrescribe originales (T113).

Se conservan las 50 correcciones más recientes según su fecha canónica y todos
sus antecedentes: máximo 50 eslabones por cadena, como la CLI. El máximo es
2500 ficheros por examen después de una rotación correcta; habitualmente son 50.
Las cadenas se validan antes de copiarlas y se escriben desde el antecedente
hacia el último reintento. Una copia conservada no pierde un antecedente durante
la rotación. Una cadena incompleta no se ofrece como recuperable y produce un
aviso durante la copia. Los ficheros corruptos no se eliminan automáticamente.

La selección para eliminar se hace sobre las copias que existen, después de
copiar: un fallo al copiar una corrección nueva no debe expulsar otra que sí
puede recuperarse. Un fallo de E/S al eliminar conserva ficheros y se avisa;
ese fallo puede impedir temporalmente cumplir el límite de retención.
