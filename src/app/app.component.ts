
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { environment } from '../environments/environment';

interface PropertyDraft {
  operation: string;
  property_type: string;
  title: string;
  price_eur: number | null;
  province: string;
  city: string;
  address: string;
  built_area_m2: number | null;
  usable_area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string;
  elevator: string;
  condition: string;
  terrace: string;
  parking: string;
  storage_room: string;
  energy_rating: string;
  description: string;
  missing_fields: string[];
  extracted_facts: string[];
  confidence_note: string;
  mode: string;
}

interface SampleFile {
  name: string;
  size: number;
  download_url: string;
}

const emptyDraft = (): PropertyDraft => ({
  operation: 'Venta',
  property_type: 'Piso',
  title: '',
  price_eur: null,
  province: '',
  city: '',
  address: '',
  built_area_m2: null,
  usable_area_m2: null,
  bedrooms: null,
  bathrooms: null,
  floor: '',
  elevator: 'No consta',
  condition: 'No consta',
  terrace: 'No consta',
  parking: 'No consta',
  storage_room: 'No consta',
  energy_rating: 'No consta',
  description: '',
  missing_fields: [],
  extracted_facts: [],
  confidence_note: 'Sube un PDF para comenzar el análisis.',
  mode: 'demo'
});

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {

  readonly apiUrl = environment.apiUrl;

  selectedFile: File | null = null;
  draft: PropertyDraft = emptyDraft();

  sampleFiles: SampleFile[] = [];
  loadingSamples = false;
  samplesError = '';
  downloadingSample: string | null = null;

  loading = false;
  generating = false;
  generatingWord = false;

  error = '';
  success = '';
  analyzed = false;

  usingSample: string | null = null;



  constructor(private readonly http: HttpClient) {
    this.loadSampleFiles();
  }

  // ============================================================
  // ARCHIVOS DE PRUEBA
  // ============================================================
  useSample(file: SampleFile): void {
  this.usingSample = file.name;
  this.error = '';
  this.success = '';

  this.http.get(
    `${this.apiUrl}/api/samples/${encodeURIComponent(file.name)}`,
    { responseType: 'blob' }
  ).subscribe({
    next: (blob) => {
      this.selectedFile = new File(
        [blob],
        file.name,
        { type: 'application/pdf' }
      );

      this.usingSample = null;
      this.success = `Documento "${file.name}" seleccionado. Ya puedes analizarlo.`;

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    },
    error: (error) => {
      console.error('Error al cargar el documento de prueba:', error);

      this.usingSample = null;
      this.error = 'No se ha podido cargar el documento de prueba. Inténtalo de nuevo.';
    }
  });
}

  loadSampleFiles(): void {
    this.loadingSamples = true;
    this.samplesError = '';

    this.http
      .get<{ files: SampleFile[] }>(
        `${this.apiUrl}/api/samples`
      )
      .subscribe({
        next: (result) => {
          this.sampleFiles = result.files ?? [];
          this.loadingSamples = false;

          if (this.sampleFiles.length === 0) {
            this.samplesError =
              'La API funciona, pero no ha encontrado archivos PDF en backend/samples/.';
          }
        },
        error: (err: HttpErrorResponse) => {
          this.sampleFiles = [];
          this.loadingSamples = false;

          this.samplesError =
            `Error al consultar los archivos de prueba. ` +
            `HTTP ${err.status || 'sin respuesta'}: ` +
            `${err.message}`;

          console.error(
            'Error al cargar archivos de prueba:',
            err
          );
        }
      });
  }


  downloadSample(file: SampleFile): void {
    this.downloadingSample = file.name;
    this.error = '';
    this.success = '';

    this.http
      .get(
        `${this.apiUrl}/api/samples/${encodeURIComponent(file.name)}`,
        { responseType: 'blob' }
      )
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');

          link.href = url;
          link.download = file.name;

          document.body.appendChild(link);
          link.click();
          link.remove();

          window.setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 1000);

          this.downloadingSample = null;
          this.success = `Archivo descargado: ${file.name}`;
        },
        error: () => {
          this.downloadingSample = null;
          this.error =
            `No se ha podido descargar ${file.name}. ` +
            'Comprueba que el backend esté disponible.';
        }
      });
  }

  formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(0)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ============================================================
  // SELECCIÓN DEL PDF
  // ============================================================

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.error = '';
    this.success = '';

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.error = 'Selecciona un documento PDF.';
      input.value = '';
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      this.error = 'El PDF no puede superar los 12 MB.';
      input.value = '';
      return;
    }

    this.selectedFile = file;
  }

  // ============================================================
  // ANÁLISIS DEL DOCUMENTO
  // ============================================================

  analyze(): void {
    if (!this.selectedFile) {
      this.error = 'Selecciona primero un PDF.';
      return;
    }

    const form = new FormData();
    form.append('file', this.selectedFile);

    this.loading = true;
    this.error = '';
    this.success = '';

    const startTime = Date.now();
    const minimumDuration = 2000;

    this.http
      .post<PropertyDraft>(
        `${this.apiUrl}/api/analyze`,
        form
      )
      .subscribe({
        next: (result) => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(
            0,
            minimumDuration - elapsed
          );

          window.setTimeout(() => {
            this.draft = result;
            this.analyzed = true;
            this.loading = false;

            this.success =
              'Análisis completado. Revisa todos los campos antes de publicar.';
          }, remaining);
        },
        error: (err: HttpErrorResponse) => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(
            0,
            minimumDuration - elapsed
          );

          window.setTimeout(() => {
            this.loading = false;
            this.error =
              err.error?.detail ??
              'No se ha podido analizar el documento. Comprueba que el backend esté arrancado.';
          }, remaining);
        }
      });
  }

  // ============================================================
  // GENERACIÓN DE LA DESCRIPCIÓN
  // ============================================================

  generateDescription(): void {
    this.generating = true;
    this.error = '';
    this.success = '';

    this.http
      .post<{ description: string; mode: string }>(
        `${this.apiUrl}/api/generate-description`,
        { property_data: this.draft }
      )
      .subscribe({
        next: (result) => {
          this.draft.description = result.description;
          this.draft.mode = result.mode;
          this.generating = false;

          this.success =
            'Descripción actualizada. Comprueba que refleja fielmente el documento.';
        },
        error: () => {
          this.generating = false;
          this.error = 'No se ha podido generar la descripción.';
        }
      });
  }

  // ============================================================
  // GENERACIÓN DEL INFORME WORD
  // ============================================================

  generateMissingInfoWord(): void {
    if (!this.analyzed) {
      this.error = 'Analiza primero un documento PDF.';
      return;
    }

    this.generatingWord = true;
    this.error = '';
    this.success = '';

    this.http
      .post(
        `${this.apiUrl}/api/missing-info-report`,
        { property_data: this.draft },
        {
          responseType: 'blob',
          observe: 'response'
        }
      )
      .subscribe({
        next: (response) => {
          const blob = response.body;

          if (!blob) {
            this.generatingWord = false;
            this.error =
              'El servidor no ha devuelto el documento Word.';
            return;
          }

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');

          link.href = url;
          link.download =
            'solicitud_informacion_inmobiliAI.docx';

          document.body.appendChild(link);
          link.click();
          link.remove();

          window.setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 1000);

          this.generatingWord = false;
          this.success =
            'Documento Word generado y descargado correctamente.';
        },
        error: () => {
          this.generatingWord = false;
          this.error =
            'No se ha podido generar el Word. Comprueba que el backend esté arrancado y que tenga instalada la dependencia python-docx.';
        }
      });
  }

  // ============================================================
  // COPIAR EL ANUNCIO
  // ============================================================

  copyListing(): void {
    const d = this.draft;

    const text = `TÍTULO
${d.title}

PRECIO
${d.price_eur ?? 'Por confirmar'} €

CARACTERÍSTICAS
Operación: ${d.operation}
Tipo: ${d.property_type}
Provincia: ${d.province || 'Por confirmar'}
Localidad: ${d.city || 'Por confirmar'}
Superficie construida: ${d.built_area_m2 ?? 'Por confirmar'} m²
Superficie útil: ${d.usable_area_m2 ?? 'Por confirmar'} m²
Dormitorios: ${d.bedrooms ?? 'Por confirmar'}
Baños: ${d.bathrooms ?? 'Por confirmar'}
Planta: ${d.floor || 'Por confirmar'}
Ascensor: ${d.elevator}
Estado: ${d.condition}
Terraza: ${d.terrace}
Garaje: ${d.parking}
Trastero: ${d.storage_room}
Calificación energética: ${d.energy_rating}

DESCRIPCIÓN
${d.description}

REVISAR ANTES DE PUBLICAR
${d.missing_fields.join(', ') || 'Confirmar todos los datos con la documentación original.'}`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.success =
          'Anuncio copiado. Ya puedes pegarlo en tu herramienta de publicación.';
        this.error = '';
      })
      .catch(() => {
        this.error =
          'El navegador no ha permitido copiar el texto. Selecciona y copia los campos manualmente.';
      });
  }

  // ============================================================
  // RESTABLECER EL FORMULARIO
  // ============================================================

  reset(): void {
    this.selectedFile = null;
    this.draft = emptyDraft();
    this.analyzed = false;
    this.error = '';
    this.success = '';
    this.generating = false;
    this.generatingWord = false;
  }

  get missingCount(): number {
    return this.draft.missing_fields.length;
  }
}
