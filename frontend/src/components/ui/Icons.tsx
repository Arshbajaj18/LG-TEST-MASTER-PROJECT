import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

/** Lucide-style thin-line icons (1.8px stroke) matching I/O Sense product iconography. */
function icon(paths: string[]) {
  return function Icon({ size = 20, strokeWidth = 1.8, ...rest }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    )
  }
}

export const ClipboardListIcon = icon([
  'M9 4h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',
  'M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2',
  'M9 12h6M9 16h4',
])
export const SearchIcon = icon(['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm21 21-4-4'])
export const PlusIcon = icon(['M12 5v14', 'M5 12h14'])
export const MoreVerticalIcon = icon(['M12 5.5h.01', 'M12 12h.01', 'M12 18.5h.01'])
export const PencilIcon = icon(['M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z', 'm15 5 4 4'])
export const TrashIcon = icon(['M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6M14 11v6'])
export const ArrowLeftIcon = icon(['M19 12H5', 'm12 19-7-7 7-7'])
export const ChevronRightIcon = icon(['m9 18 6-6-6-6'])
export const ChevronLeftIcon = icon(['m15 18-6-6 6-6'])
export const UploadIcon = icon(['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'])
export const FileSpreadsheetIcon = icon([
  'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z',
  'M14 2v6h6',
  'M8 13h2M14 13h2M8 17h2M14 17h2',
])
export const XIcon = icon(['M18 6 6 18', 'm6 6 12 12'])
export const AlertTriangleIcon = icon([
  'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  'M12 9v4',
  'M12 17h.01',
])
export const CheckCircleIcon = icon(['M22 11.1V12a10 10 0 1 1-5.9-9.1', 'm22 4-10 10-3-3'])
export const RefreshIcon = icon(['M21 12a9 9 0 1 1-2.6-6.4L21 8', 'M21 3v5h-5'])
export const LayersIcon = icon(['m12 2 9 5-9 5-9-5 9-5Z', 'm3 12 9 5 9-5', 'm3 17 9 5 9-5'])
export const BeakerIcon = icon(['M9 3h6', 'M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3', 'M7 15h10'])
export const BoxesIcon = icon(['M21 8 12 3 3 8v8l9 5 9-5Z', 'M3 8l9 5 9-5', 'M12 13v8'])
