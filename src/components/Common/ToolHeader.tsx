import React from 'react';
import { Button } from '../ui/button';
import { ArrowLeft } from 'lucide-react';

interface ToolHeaderProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  onGoHome: () => void;
  badge?: string;
  actions?: React.ReactNode;
  fileName?: string;
  fileMeta?: string;
}

export const ToolHeader: React.FC<ToolHeaderProps> = ({
  title,
  description,
  icon: Icon,
  onGoHome,
  badge,
  actions
}) => {
  return (
    <header className="tool-layout__header">
      <div className="tool-layout__identity">
        {Icon && (
          <div className="tool-layout__icon">
            <Icon aria-hidden="true" />
          </div>
        )}
        <div className="tool-layout__copy">
          <div className="tool-layout__title-row">
            <h1>{title}</h1>
            {badge && (
              <span className="tool-layout__badge">
                {badge}
              </span>
            )}
          </div>
          <p>{description}</p>
        </div>
      </div>

      <div className="tool-layout__actions">
        {actions}
        <Button
          variant="outline" 
          size="sm" 
          onClick={onGoHome} 
          className="tool-layout__back"
          aria-label="Back to all tools"
          title="Back to all tools"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
};
