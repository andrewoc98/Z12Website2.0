export default function PublishControls({ publishMode, setPublishMode }: any) {

    return (
        <div className="card publish-controls">

            <h3>Results Publishing</h3>

            <select
                value={publishMode}
                onChange={e => setPublishMode(e.target.value)}
            >
                <option value="live">Live Results</option>
                <option value="category_complete">After Category Finished</option>
                <option value="manual">Manual Publish</option>
            </select>

        </div>
    );
}