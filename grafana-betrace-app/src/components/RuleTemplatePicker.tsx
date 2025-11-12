import React, { useState, useMemo } from 'react';
import {
  Button,
  Field,
  Input,
  Select,
  Modal,
  Card,
  Badge,
  VerticalGroup,
  HorizontalGroup,
  Icon,
  Alert,
} from '@grafana/ui';
import {
  allTemplates,
  searchTemplates,
  getTemplatesByCategory,
  templateStats,
  type RuleTemplate,
  type TemplateParameter,
} from '../lib/rule-templates';

interface RuleTemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (expression: string, templateInfo?: { name: string; description: string }) => void;
}

/**
 * RuleTemplatePicker - Template library UI component
 *
 * Features:
 * - Browse 45 pre-built templates
 * - Search by keyword
 * - Filter by category
 * - Customize parameters
 * - Preview expression
 */
export const RuleTemplatePicker: React.FC<RuleTemplatePickerProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [customParams, setCustomParams] = useState<Record<string, any>>({});
  const [showCustomization, setShowCustomization] = useState(false);

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let templates = selectedCategory === 'all'
      ? allTemplates
      : getTemplatesByCategory(selectedCategory);

    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery).filter(t =>
        selectedCategory === 'all' || t.category === selectedCategory
      );
    }

    return templates;
  }, [searchQuery, selectedCategory]);

  // Apply parameter customization
  const getCustomizedExpression = (template: RuleTemplate): string => {
    if (!template.parameters || template.parameters.length === 0) {
      return template.expression;
    }

    let expression = template.expression;
    template.parameters.forEach(param => {
      const value = customParams[param.name] ?? param.defaultValue;
      // Simple string replacement for parameter values
      expression = expression.replace(
        new RegExp(String(param.defaultValue), 'g'),
        String(value)
      );
    });

    return expression;
  };

  const handleSelectTemplate = (template: RuleTemplate) => {
    if (template.parameters && template.parameters.length > 0) {
      // Show customization wizard
      setSelectedTemplate(template);
      setShowCustomization(true);
      // Initialize custom params with defaults
      const defaults: Record<string, any> = {};
      template.parameters.forEach(param => {
        defaults[param.name] = param.defaultValue;
      });
      setCustomParams(defaults);
    } else {
      // No parameters - use template directly
      onSelectTemplate(template.expression, {
        name: template.name,
        description: template.description,
      });
      handleClose();
    }
  };

  const handleApplyCustomization = () => {
    if (selectedTemplate) {
      const expression = getCustomizedExpression(selectedTemplate);
      onSelectTemplate(expression, {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
      });
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedTemplate(null);
    setShowCustomization(false);
    setCustomParams({});
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  // Customization wizard view
  if (showCustomization && selectedTemplate) {
    return (
      <Modal
        title={`Customize: ${selectedTemplate.name}`}
        isOpen={true}
        onDismiss={() => setShowCustomization(false)}
      >
        <VerticalGroup spacing="lg">
          <Alert title="Template Parameters" severity="info">
            Customize the parameters below to adapt this template to your needs.
          </Alert>

          {selectedTemplate.parameters?.map(param => (
            <Field
              key={param.name}
              label={param.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              description={param.description}
            >
              {param.type === 'number' ? (
                <Input
                  type="number"
                  value={customParams[param.name] ?? param.defaultValue}
                  onChange={(e) => setCustomParams({ ...customParams, [param.name]: parseFloat(e.currentTarget.value) })}
                  placeholder={param.placeholder}
                  width={30}
                />
              ) : param.type === 'boolean' ? (
                <Select
                  value={String(customParams[param.name] ?? param.defaultValue)}
                  onChange={(e) => setCustomParams({ ...customParams, [param.name]: e.value === 'true' })}
                  options={[
                    { label: 'True', value: 'true' },
                    { label: 'False', value: 'false' },
                  ]}
                  width={20}
                />
              ) : (
                <Input
                  value={customParams[param.name] ?? param.defaultValue}
                  onChange={(e) => setCustomParams({ ...customParams, [param.name]: e.currentTarget.value })}
                  placeholder={param.placeholder}
                  width={40}
                />
              )}
            </Field>
          ))}

          <Field label="Preview">
            <div style={{
              backgroundColor: '#1f1f1f',
              padding: '12px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '13px',
              color: '#d4d4d4',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              {getCustomizedExpression(selectedTemplate)}
            </div>
          </Field>

          <HorizontalGroup spacing="sm">
            <Button variant="primary" onClick={handleApplyCustomization}>
              <Icon name="check" /> Use Template
            </Button>
            <Button variant="secondary" onClick={() => setShowCustomization(false)}>
              <Icon name="arrow-left" /> Back
            </Button>
          </HorizontalGroup>
        </VerticalGroup>
      </Modal>
    );
  }

  // Main template picker view
  return (
    <Modal
      title="Rule Template Library"
      isOpen={true}
      onDismiss={handleClose}
    >
      <VerticalGroup spacing="lg">
        {/* Header with stats */}
        <Alert title="45 Pre-built Templates" severity="info">
          Choose from {templateStats.total} production-ready rule templates covering AI Safety ({templateStats.byCategory['ai-safety']}),
          Compliance ({templateStats.byCategory['compliance']}), SRE ({templateStats.byCategory['sre']}),
          Security ({templateStats.byCategory['security']}), and Performance ({templateStats.byCategory['performance']}).
        </Alert>

        {/* Search and filter controls */}
        <HorizontalGroup spacing="sm">
          <Field label="Search" style={{ flexGrow: 1 }}>
            <Input
              prefix={<Icon name="search" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Search by name, description, or tags..."
              width={0}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Category">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.value || 'all')}
              options={[
                { label: `All (${templateStats.total})`, value: 'all' },
                { label: `AI Safety (${templateStats.byCategory['ai-safety']})`, value: 'ai-safety' },
                { label: `Compliance (${templateStats.byCategory['compliance']})`, value: 'compliance' },
                { label: `SRE (${templateStats.byCategory['sre']})`, value: 'sre' },
                { label: `Security (${templateStats.byCategory['security']})`, value: 'security' },
                { label: `Performance (${templateStats.byCategory['performance']})`, value: 'performance' },
              ]}
              width={30}
            />
          </Field>
        </HorizontalGroup>

        {/* Template cards */}
        <div style={{
          maxHeight: '500px',
          overflowY: 'auto',
          padding: '4px',
        }}>
          {filteredTemplates.length === 0 ? (
            <Alert title="No templates found" severity="warning">
              No templates match your search criteria. Try adjusting your search or category filter.
            </Alert>
          ) : (
            <VerticalGroup spacing="sm">
              {filteredTemplates.map(template => (
                <Card key={template.id} style={{ padding: '12px' }}>
                  <VerticalGroup spacing="sm">
                    <HorizontalGroup justify="space-between" align="flex-start">
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 4px 0' }}>
                          {template.name}
                          {template.parameters && template.parameters.length > 0 && (
                            <Badge
                              text="Customizable"
                              color="blue"
                              icon="sliders-v-alt"
                              style={{ marginLeft: '8px' }}
                            />
                          )}
                        </h4>
                        <p style={{ margin: '0 0 8px 0', color: '#888', fontSize: '13px' }}>
                          {template.description}
                        </p>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <Badge text={template.category} color="purple" />
                          {template.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} text={tag} color="orange" />
                          ))}
                          {template.tags.length > 3 && (
                            <Badge text={`+${template.tags.length - 3} more`} color="orange" />
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSelectTemplate(template)}
                        icon={template.parameters && template.parameters.length > 0 ? 'sliders-v-alt' : 'plus'}
                      >
                        {template.parameters && template.parameters.length > 0 ? 'Customize' : 'Use Template'}
                      </Button>
                    </HorizontalGroup>
                    <div style={{
                      backgroundColor: '#f5f5f5',
                      padding: '8px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      color: '#333',
                      overflow: 'auto',
                    }}>
                      {template.expression}
                    </div>
                    {template.examples && template.examples.length > 0 && (
                      <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                        💡 {template.examples[0]}
                      </div>
                    )}
                  </VerticalGroup>
                </Card>
              ))}
            </VerticalGroup>
          )}
        </div>

        {/* Footer */}
        <HorizontalGroup justify="space-between">
          <div style={{ fontSize: '13px', color: '#888' }}>
            Showing {filteredTemplates.length} of {templateStats.total} templates
          </div>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </HorizontalGroup>
      </VerticalGroup>
    </Modal>
  );
};
