import { memo } from 'react';
import { Button } from '../Button';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { classNames } from '@/shared/lib/classNames/classNames';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  siblingCount?: number;
}

const DOTS = '...';

export const Pagination = memo(({
  currentPage,
  totalPages,
  onPageChange,
  className,
  siblingCount = 1
}: PaginationProps) => {
  
  if (totalPages <= 1) {
    return null;
  }

  // Generate pagination range
  const generatePaginationRange = () => {
    const totalPageNumbers = siblingCount + 5;

    if (totalPageNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, DOTS, totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + 1 + i);
      return [firstPageIndex, DOTS, ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from({ length: rightSiblingIndex - leftSiblingIndex + 1 }, (_, i) => leftSiblingIndex + i);
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
    }
    
    return [];
  };

  const paginationRange = generatePaginationRange();

  return (
    <nav 
      role="navigation" 
      aria-label="pagination" 
      className={classNames("mx-auto flex w-full justify-center", {}, [className || ""])}
    >
      <ul className="flex flex-row items-center gap-1">
        <li>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 pl-2.5"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Назад</span>
          </Button>
        </li>
        
        {paginationRange.map((pageNumber, index) => {
          if (pageNumber === DOTS) {
            return (
              <li key={`dots-${index}`} className="flex h-9 w-9 items-center justify-center">
                <MoreHorizontal className="h-4 w-4" />
              </li>
            );
          }

          const isCurrentPage = pageNumber === currentPage;
          return (
            <li key={pageNumber}>
              <Button
                variant={isCurrentPage ? "outline" : "ghost"}
                size="sm"
                className={classNames("h-9 w-9 p-0", { "font-bold text-indigo-500": isCurrentPage })}
                onClick={() => onPageChange(pageNumber as number)}
              >
                {pageNumber}
              </Button>
            </li>
          );
        })}

        <li>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 pr-2.5"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <span>Вперёд</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </li>
      </ul>
    </nav>
  );
});

Pagination.displayName = 'Pagination';
