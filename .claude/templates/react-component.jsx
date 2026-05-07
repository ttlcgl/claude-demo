import React from 'react';

/**
 * Component template for new React components.
 * Delete this file or use it as a reference.
 */

export function {{ComponentName}}({ {{props}} }) {
  return (
    <div className="{{component-name}}">
      <h2>{{ComponentName}}</h2>
      {/* Add component content here */}
    </div>
  );
}

{{ComponentName}}.propTypes = {
  {{props}}: PropTypes.any.isRequired,
};

export default {{ComponentName}};
